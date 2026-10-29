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
import { readdir, rm } from 'node:fs/promises';
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

/** Largest accepted delete request body. */
const MAX_BODY_BYTES = 64 * 1024;

/** Largest number of Sessions one request may delete. */
const MAX_DELETE_COUNT = 500;

/** Session ids are the `session-<uuid>` strings the store mints. */
const SESSION_ID = /^session-[0-9a-fA-F-]{8,64}$/;

/**
 * Home-relative roots this plugin reads.
 * @returns the session persistence root and the storage root.
 */
function homeRoots() {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh');
  return {
    sessions: join(home, 'sessions'),
    storages: join(home, 'storages'),
  };
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
 * @returns the parsed body, or `{}` for an empty body.
 */
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('请求体过大');
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
