/**
 * Host half of the Session Admin bundle.
 *
 * DSH ships no Session deletion API: this plugin removes a cold Session's
 * session-owned directory under the JSONL persistence root, plus its
 * projection-cache checkpoint. Live Sessions are refused, because the running
 * Agent still owns the log. The Workspace registry keeps its launch-time
 * header index in memory, so the sidebar drops a deleted row only after the
 * host restarts; this plugin's own settings page refreshes immediately.
 *
 * Two callers share one operation: the settings page posts to the plugin route
 * (same-origin, admitted by Connection's trust check) and the `session_admin`
 * agent tool calls the same functions in process.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

export const name = 'session-admin';

export const inject = [
  'tools',
  'webServer',
  'sessionPersistence',
  'sessionProjectionCache',
];

/** Same-origin delete endpoint owned by this plugin. */
const DELETE_PATH = '/plugins/session-admin/delete';

/** Same-origin endpoint returning this plugin's session tree layout. */
const TREE_PATH = '/plugins/session-admin/tree';

/** Same-origin endpoint replacing the stored session tree layout. */
const LAYOUT_PATH = '/plugins/session-admin/layout';

/** Largest accepted delete request body. */
const MAX_BODY_BYTES = 64 * 1024;

/** Largest accepted layout request body. */
const MAX_LAYOUT_BYTES = 256 * 1024;

/** Largest number of Sessions one request may delete. */
const MAX_DELETE_COUNT = 500;

/** Session ids are the `session-<uuid>` strings the store mints. */
const SESSION_ID = /^session-[0-9a-fA-F-]{8,64}$/;

/** Workspace ids the layout may reference. */
const WORKSPACE_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Folder key prefixes shared with the client (`src/client/layout.js`). */
const WORKSPACE_PREFIX = '工作区:';
const CUSTOM_PREFIX = '自定义:';

/**
 * Home-relative roots this plugin reads.
 * @returns the DSH home, the session persistence root, and the storage root.
 */
function homeRoots() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return {
    home,
    sessions: join(home, 'sessions'),
    storages: join(home, 'storages'),
  };
}

/**
 * Whether a directory entry may name a tree folder: one plain path segment.
 * @param value - candidate name.
 * @returns true for a name that stays inside the tree root.
 */
function isPlainName(value) {
  return (
    value !== '' &&
    value !== '.' &&
    value !== '..' &&
    !value.startsWith('.') &&
    !value.includes('/') &&
    !value.includes('\\')
  );
}

/**
 * Split a folder key into its kind and value.
 * @param key - `工作区:<id>` or `自定义:<name>`.
 * @returns `{ kind, value }`, or null for anything else.
 */
function parseFolderKey(key) {
  if (typeof key !== 'string') return null;
  if (key.startsWith(WORKSPACE_PREFIX)) {
    const value = key.slice(WORKSPACE_PREFIX.length);
    return WORKSPACE_ID.test(value) ? { kind: 'workspace', value } : null;
  }
  if (key.startsWith(CUSTOM_PREFIX)) {
    const value = key.slice(CUSTOM_PREFIX.length);
    return isPlainName(value) ? { kind: 'custom', value } : null;
  }
  return null;
}

/**
 * @returns a fresh, empty tree layout.
 */
function emptyLayout() {
  return { version: 1, order: [], folders: [], placement: {}, pinned: [], sessions: {} };
}

/**
 * Validate and canonicalize a layout received from the browser. Throws instead
 * of dropping entries: a rejected write keeps the stored file intact.
 * @param raw - parsed JSON.
 * @returns the normalized layout.
 */
function normalizeLayout(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('布局格式不正确');
  if (raw.version !== undefined && raw.version !== 1) throw new Error('布局版本不受支持');
  const folders = [];
  for (const name of Array.isArray(raw.folders) ? raw.folders : []) {
    if (!isPlainName(name) || folders.includes(name)) throw new Error(`文件夹名无效：${String(name)}`);
    folders.push(name);
  }
  const order = [];
  for (const key of Array.isArray(raw.order) ? raw.order : []) {
    const parsed = parseFolderKey(key);
    if (parsed === null) throw new Error(`文件夹键无效：${String(key)}`);
    if (parsed.kind === 'custom' && !folders.includes(parsed.value)) throw new Error(`未知的自定义文件夹：${parsed.value}`);
    if (!order.includes(key)) order.push(key);
  }
  for (const name of folders) {
    const key = CUSTOM_PREFIX + name;
    if (!order.includes(key)) order.push(key);
  }
  const placement = {};
  const rawPlacement = raw.placement ?? {};
  if (rawPlacement === null || typeof rawPlacement !== 'object' || Array.isArray(rawPlacement)) {
    throw new Error('placement 格式不正确');
  }
  for (const [id, key] of Object.entries(rawPlacement)) {
    if (!SESSION_ID.test(id)) throw new Error(`会话 id 无效：${id}`);
    const parsed = parseFolderKey(key);
    if (parsed === null) throw new Error(`placement 里的文件夹键无效：${String(key)}`);
    if (parsed.kind === 'custom' && !folders.includes(parsed.value)) throw new Error(`未知的自定义文件夹：${parsed.value}`);
    placement[id] = key;
  }
  const pinned = [];
  for (const entry of Array.isArray(raw.pinned) ? raw.pinned : []) {
    if (typeof entry !== 'string') throw new Error('pinned 里有无效项');
    if (!SESSION_ID.test(entry) && parseFolderKey(entry) === null) throw new Error(`pinned 里有无效项：${entry}`);
    if (!pinned.includes(entry)) pinned.push(entry);
  }
  const sessions = {};
  const rawSessions = raw.sessions ?? {};
  if (rawSessions === null || typeof rawSessions !== 'object' || Array.isArray(rawSessions)) {
    throw new Error('sessions 格式不正确');
  }
  for (const [key, ids] of Object.entries(rawSessions)) {
    const parsed = parseFolderKey(key);
    if (parsed === null) throw new Error(`sessions 里的文件夹键无效：${String(key)}`);
    if (parsed.kind === 'custom' && !folders.includes(parsed.value)) {
      throw new Error(`未知的自定义文件夹：${parsed.value}`);
    }
    const list = [];
    for (const id of Array.isArray(ids) ? ids : []) {
      if (!SESSION_ID.test(id)) throw new Error(`sessions 里的会话 id 无效：${String(id)}`);
      if (list.includes(id)) continue;
      list.push(id);
    }
    if (list.length > 0) sessions[key] = list;
  }
  return { version: 1, order, folders, placement, pinned, sessions };
}

/**
 * Send one JSON response.
 * @param res - the server response.
 * @param status - HTTP status.
 * @param value - JSON body.
 */
function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

/**
 * Read a bounded JSON request body.
 * @param req - the incoming request.
 * @param maxBytes - largest accepted body.
 * @returns the parsed body, or `{}` for an empty body.
 */
async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text === '') return {};
  return JSON.parse(text);
}

/**
 * Apply Connection's Host/Origin and browser-authentication checks to this
 * plugin's route. Rejections are written here and reported to the caller.
 * @param ctx - plugin context.
 * @param req - the incoming request.
 * @param res - the server response.
 * @returns whether the request was rejected.
 */
function rejectUntrusted(ctx, req, res) {
  const connection = ctx.get('connection');
  if (connection === undefined) return false;
  const rejection = connection.requestRejection(req);
  if (rejection === undefined) return false;
  sendJson(res, rejection, {
    ok: false,
    error: rejection === 401 ? '未通过浏览器鉴权' : '受信任来源校验失败',
  });
  return true;
}

/**
 * Register the plugin's capability on one Host context.
 * @param ctx - plugin context carrying the tool and Web carrier services.
 */
export function apply(ctx) {
  const roots = homeRoots();
  const sessionsRoot = resolve(roots.sessions);
  const checkpointRoot = resolve(roots.storages, 'session_projcache', 'sessions');
  const treeRoot = resolve(roots.home, 'session-admin', 'tree');
  const layoutFile = join(treeRoot, 'layout.json');

  /**
   * Read the stored layout. A missing file is an empty layout; a corrupt file
   * throws, so the next write never silently drops the user's tree.
   * @returns the normalized layout.
   */
  async function readLayout() {
    let text;
    try {
      text = await readFile(layoutFile, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return emptyLayout();
      throw error;
    }
    if (text.trim() === '') return emptyLayout();
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new Error('布局文件不是合法 JSON，未做任何修改');
    }
    return normalizeLayout(raw);
  }

  /**
   * Replace the stored layout atomically: a temp file plus a rename, so a
   * failed write keeps the previous file.
   * @param layout - normalized layout.
   */
  async function writeLayout(layout) {
    await mkdir(treeRoot, { recursive: true });
    const temp = join(treeRoot, `.layout.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temp, `${JSON.stringify(layout, null, 2)}\n`, 'utf8');
    await rename(temp, layoutFile);
  }

  /**
   * Drop deleted Sessions from the stored layout. Failures are swallowed on
   * purpose: the Session is already gone, and a stale id is harmless.
   * @param ids - deleted session ids.
   */
  async function pruneLayout(ids) {
    if (ids.length === 0) return;
    try {
      const layout = await readLayout();
      const placement = {};
      for (const [id, key] of Object.entries(layout.placement)) {
        if (!ids.includes(id)) placement[id] = key;
      }
      const pinned = layout.pinned.filter((entry) => !ids.includes(entry));
      const sessions = {};
      for (const [key, list] of Object.entries(layout.sessions)) {
        const kept = list.filter((id) => !ids.includes(id));
        if (kept.length > 0) sessions[key] = kept;
      }
      const untouched =
        Object.keys(placement).length === Object.keys(layout.placement).length &&
        pinned.length === layout.pinned.length &&
        Object.keys(sessions).length === Object.keys(layout.sessions).length;
      if (untouched) return;
      await writeLayout({ ...layout, placement, pinned, sessions });
    } catch {
      // The tree layout is a convenience cache, not session state.
    }
  }

  /**
   * Whether the runtime is currently running this Session. An attached but
   * idle Agent is not running, and its log holds no open handle between
   * operations, so only an active turn blocks deletion.
   * @param id - session id.
   * @returns true while a turn is in progress.
   */
  const isRunning = (id) => ctx.get('agents')?.get(id)?.status === 'running';

  /**
   * Index every session-owned directory under the persistence root.
   * @returns a map from session id to its absolute directory.
   */
  async function scanSessionDirs() {
    const found = new Map();
    let projects;
    try {
      projects = await readdir(sessionsRoot, { withFileTypes: true });
    } catch {
      return found;
    }
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      const projectDir = join(sessionsRoot, project.name);
      let entries;
      try {
        entries = await readdir(projectDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || !SESSION_ID.test(entry.name)) continue;
        const absolute = resolve(projectDir, entry.name);
        if (!absolute.startsWith(sessionsRoot + sep)) continue;
        found.set(entry.name, absolute);
      }
    }
    return found;
  }

  /**
   * List stored Sessions with their listed title.
   * @returns model-facing rows, newest first.
   */
  async function listSessions() {
    const snapshots = await ctx.sessionPersistence.list();
    const rows = snapshots.map((snapshot) => {
      const title = ctx.sessionProjectionCache.cachedSnapshot(snapshot.header, ['title'])?.values.title;
      return {
        id: snapshot.header.id,
        title: typeof title === 'string' ? title : '',
        cwd: snapshot.header.cwd ?? '',
        createdAt: snapshot.header.createdAt,
        bytes: snapshot.sizeBytes ?? 0,
        running: isRunning(snapshot.header.id),
      };
    });
    rows.sort((left, right) => right.createdAt - left.createdAt);
    return rows;
  }

  /**
   * Delete the requested cold Sessions.
   * @param ids - candidate session ids.
   * @returns the deleted ids and one reason per skipped id.
   */
  async function deleteSessions(ids) {
    const deleted = [];
    const skipped = [];
    const index = await scanSessionDirs();
    const seen = new Set();
    for (const raw of ids) {
      const id = typeof raw === 'string' ? raw.trim() : '';
      if (!SESSION_ID.test(id)) {
        skipped.push({ id: String(raw), reason: '不是有效的会话 id' });
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      if (isRunning(id)) {
        skipped.push({ id, reason: '会话正在运行，先停止再删' });
        continue;
      }
      const directory = index.get(id);
      if (directory === undefined) {
        skipped.push({ id, reason: '磁盘上找不到会话文件' });
        continue;
      }
      try {
        await rm(directory, { recursive: true, force: true });
        await rm(join(checkpointRoot, `${id}.json`), { force: true });
        deleted.push(id);
      } catch (error) {
        skipped.push({ id, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return { deleted, skipped };
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: DELETE_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' });
            res.end();
            return;
          }
          if (rejectUntrusted(ctx, req, res)) return;
          let body;
          try {
            body = await readJsonBody(req);
          } catch (error) {
            sendJson(res, 400, {
              ok: false,
              error: error instanceof Error ? error.message : '请求体无法解析',
            });
            return;
          }
          const ids = Array.isArray(body?.ids) ? body.ids : [];
          if (ids.length === 0) {
            sendJson(res, 400, { ok: false, error: '没有选择会话' });
            return;
          }
          if (ids.length > MAX_DELETE_COUNT) {
            sendJson(res, 400, { ok: false, error: `一次最多删除 ${MAX_DELETE_COUNT} 个会话` });
            return;
          }
          try {
            const result = await deleteSessions(ids);
            await pruneLayout(result.deleted);
            ctx.logger?.info?.(
              `session-admin: deleted ${result.deleted.length}, skipped ${result.skipped.length}`,
            );
            sendJson(res, 200, { ok: true, ...result });
          } catch (error) {
            sendJson(res, 500, {
              ok: false,
              error: error instanceof Error ? error.message : '删除失败',
            });
          }
        },
      }),
    'session-admin: delete route',
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: TREE_PATH,
        handler: async (req, res) => {
          if (req.method !== 'GET') {
            res.writeHead(405, { allow: 'GET' });
            res.end();
            return;
          }
          if (rejectUntrusted(ctx, req, res)) return;
          try {
            sendJson(res, 200, { ok: true, layout: await readLayout() });
          } catch (error) {
            sendJson(res, 500, {
              ok: false,
              error: error instanceof Error ? error.message : '读取会话树失败',
            });
          }
        },
      }),
    'session-admin: tree route',
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: LAYOUT_PATH,
        handler: async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, { allow: 'POST' });
            res.end();
            return;
          }
          if (rejectUntrusted(ctx, req, res)) return;
          let body;
          try {
            body = await readJsonBody(req, MAX_LAYOUT_BYTES);
          } catch (error) {
            sendJson(res, 400, {
              ok: false,
              error: error instanceof Error ? error.message : '请求体无法解析',
            });
            return;
          }
          if (body === null || typeof body !== 'object' || body.layout === undefined) {
            sendJson(res, 400, { ok: false, error: '缺少布局内容' });
            return;
          }
          try {
            const layout = normalizeLayout(body.layout);
            await writeLayout(layout);
            sendJson(res, 200, { ok: true, layout });
          } catch (error) {
            sendJson(res, 400, {
              ok: false,
              error: error instanceof Error ? error.message : '保存会话树失败',
            });
          }
        },
      }),
    'session-admin: layout route',
  );

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'session_admin',
        description:
          'List or permanently delete stored Harness Sessions. `list` returns id, title, working directory, creation time, size, and whether the Session is live. `delete` removes the session-owned files of every listed id and permanently discards its history; a live Session is skipped. Ask the user before deleting, and never delete the Session you are running in.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['action'],
          properties: {
            action: { type: 'string', enum: ['list', 'delete'], description: 'list stored Sessions, or delete the given ids.' },
            ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Session ids to delete; required for the delete action.',
            },
          },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['action', 'sessions', 'deleted', 'skipped'],
            properties: {
              action: { type: 'string' },
              sessions: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'title', 'cwd', 'createdAt', 'bytes', 'running'],
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    cwd: { type: 'string' },
                    createdAt: { type: 'integer' },
                    bytes: { type: 'integer' },
                    running: { type: 'boolean' },
                  },
                },
              },
              deleted: { type: 'array', items: { type: 'string' } },
              skipped: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'reason'],
                  properties: {
                    id: { type: 'string' },
                    reason: { type: 'string' },
                  },
                },
              },
            },
          },
          render: (_args, value) => {
            if (value.action === 'list') {
              if (value.sessions.length === 0) return [{ type: 'text', text: '没有已保存的会话。' }];
              const lines = value.sessions.map((row) => {
                const title = row.title === '' ? '(未命名)' : row.title;
                const where = row.cwd === '' ? '' : ` · ${row.cwd}`;
                const live = row.running ? ' · 运行中' : '';
                return `- ${row.id} · ${title}${where} · ${row.bytes} B${live}`;
              });
              return [{ type: 'text', text: `共 ${value.sessions.length} 个会话：\n${lines.join('\n')}` }];
            }
            const skipped = value.skipped.map((row) => `${row.id}: ${row.reason}`).join('\n');
            const head = `已删除 ${value.deleted.length} 个会话。`;
            return [{ type: 'text', text: skipped === '' ? head : `${head}\n跳过 ${value.skipped.length} 个：\n${skipped}` }];
          },
        },
        async execute(args) {
          const action = args?.action;
          if (action === 'list') {
            return { action, sessions: await listSessions(), deleted: [], skipped: [] };
          }
          if (action !== 'delete') throw new Error('action must be `list` or `delete`');
          if (!Array.isArray(args.ids) || args.ids.length === 0) {
            throw new Error('delete requires a non-empty `ids` array');
          }
          if (args.ids.length > MAX_DELETE_COUNT) {
            throw new Error(`at most ${MAX_DELETE_COUNT} ids per call`);
          }
          const result = await deleteSessions(args.ids);
          return { action, sessions: [], deleted: result.deleted, skipped: result.skipped };
        },
      }),
    'session-admin: agent tool',
  );
}
