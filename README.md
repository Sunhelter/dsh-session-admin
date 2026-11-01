# dsh-session-admin

A small plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) that adds **permanent Session deletion**, which the stock Web UI does not offer (it only archives Sessions).

Tested against DSH `0.2.1-rc.5` with the `web` profile.

## What it adds

| Surface | What you get |
|---|---|
| Settings → **Sessions** | A tree of folders grouped by Workspace, plus your own folders and an **Unsorted** group. Rows look like the shipped sidebar tree: hover for the row actions, relative update time on the right. Drag a Session into another folder, drag folder headers to reorder, pin Sessions and folders to the top. Search, select rows, select all, then delete in bulk behind one confirmation. A row's `…` menu pins, archives (or restores) and deletes; **Show archived** in the toolbar reveals archived rows, which cannot be opened until unarchived. With rows selected, **Archive** and **Unarchive** act in bulk, skipping rows already in the other state (running Sessions are left out with a note). Running Sessions are not selectable. |
| Folder row actions | **`...`** renames or deletes the folder, and pins or unpins it; the **`+`** on a Workspace folder starts a new Session there (on your own folder it starts a plain new Session). |
| Session row **`...` menu** | Pin or unpin the Session, or a red **Delete session** row that confirms one Session and deletes it. |
| Agent tool `session_admin` | `action: "list"` returns id, title, directory, creation time, size and running state; `action: "delete"` removes the given ids. Lets you clean up by asking the agent instead of clicking. |

All callers share one Host-side operation.

Moving and pinning are **display-only**: a Session keeps its native Workspace membership, and a move only changes where the plugin's tree draws it.

Empty Sessions (a Session created but never used) are hidden unless it is the one currently open, matching the shipped sidebar. A deleted Session also leaves the native sidebar only after the Host restarts; see below.

## Install

The plugin is a DSH **bundle**: a package whose `package.json` declares `dsh.bundle.patch` plus a browser half under `dsh.client`.

1. Put this directory somewhere stable. DSH tracks it as a `link:` dependency, so the directory must stay in place afterwards.
2. Install it into a DSH profile as a bundle — for example by pointing the `plugin_manager` tool's `install_bundle` action at this directory:

   ```
   install_bundle  target=/absolute/path/to/dsh-session-admin
   ```

3. Restart the Harness once. The Host half activates immediately, but a freshly installed bundle's browser half only joins the Web boot graph on the next start.

Uninstalling with `remove_bundle` and reinstalling from a different path requires the same restart.

## How deletion works

A stored Session is a session-owned directory under the session-persistence root, plus its projection checkpoint:

```
$DSH_HOME/sessions/<project>/<session-id>/session.vN.jsonl.zstd
$DSH_HOME/storages/session_projcache/sessions/<session-id>.json
```

The plugin scans that root for the requested ids and removes both. DSH exposes no deletion API, so this is intentionally a direct filesystem operation with the following consequences:

- **It is permanent.** There is no trash and no undo. The confirmation dialogs exist for that reason.
- **A Session whose turn is running is skipped**, and reported back with a reason. While a turn runs, its writer owns the log.
- **The native sidebar keeps showing a deleted row until the Host restarts.** The Workspace registry builds its session index at startup and caches membership in memory; it does not re-read the persistence root. The settings page drops deleted rows immediately, but the sidebar row, its hover card and any open reference stay stale until a restart. The durable `workspace.json` still lists the id; the next startup filters it out and the next Workspace mutation prunes it.
- **A Session that exists only in memory cannot be deleted.** If a Session's files were removed by something else while the Host kept the object alive, the Host still lists it; the plugin reports "no session files on disk" for it, and only a restart clears it.

## The tree

The tree state lives next to the plugin's data under the DSH home:

```
$DSH_HOME/session-admin/tree/layout.json
```

It records the folder order (`order`), your own folder names (`folders`), where individual Sessions are drawn (`placement`), the pinned list (`pinned`, holding Session ids and folder keys) and the order inside each folder you reordered (`sessions`). Folder keys are `工作区:<workspaceId>` and `自定义:<name>`; anything unrecorded falls back to the Session's own Workspace.

- Rendering reads the native Workspace snapshot first, then applies the recorded operations. Sessions nobody moved stay in their Workspace folder, so a fresh install looks exactly like the native grouping.
- Deleting a Workspace folder deletes the Workspace (its Sessions fall back to Unsorted). Deleting your own folder only drops the folder: its Sessions return to their Workspaces.
- Dragging a Session onto another row drops it in front of that row; dropping it on a folder header or the empty space below the rows appends it to that folder.
- Folder order also feeds the native sidebar: after a drag the plugin pushes the Workspace order back through `workspaces.insertBefore`.
- Deleting a Session prunes its `placement`, `pinned` and `sessions` entries.

## Security

The browser half posts to a plugin-owned route:

```
POST /plugins/session-admin/delete   {"ids": ["session-...", "..."]}
GET  /plugins/session-admin/tree
POST /plugins/session-admin/layout   {"layout": {...}}
```

Each route runs `ctx.connection.requestRejection()` first, so it applies DSH's Host/Origin checks and browser authentication to plugin routes: an unauthenticated request gets `401`, a cross-origin one `403`. Ids are validated against the Session-id shape, duplicates are dropped, a request is capped at 500 ids and 64 KiB.

The layout route validates folder names and keys (no path separators, no `.`/`..`), Session ids and the bounded body size, then replaces the file through a temp file and a rename, so a rejected write leaves the stored tree untouched.

It still inherits the deployment's own exposure: a DSH instance that anyone on the network can drive without authentication can also drive this route.

## Layout

| File | Role |
|---|---|
| `index.js` | Host half: delete and tree routes, layout storage, session scanning, the `session_admin` agent tool. |
| `src/client/` | Browser-half source: `index.js` entry, `apply.js` seat registrations, `i18n.js`, `styles.js`, `api.js`, `format.js`, `layout.js` (folder keys and layout mutations), `stores/`, `components/` (the tree lives in `components/session-tree.js`). |
| `client.js` | **Generated** bundle of `src/client/` — the file the Host serves. Never edit it by hand. |
| `build.mjs` | esbuild wrapper that emits `client.js` (`npm run build`, or `npm run watch`). |
| `cordis.patch.yml` | Bundle patch that inserts the Host row. |
| `locale/en.json`, `locale/zh.json` | Plugin-manager display metadata (title, description). |
| `icon.svg` | Plugin artwork. |

The browser half uses only the public client surfaces. React, the icons, `Menu`, `Tooltip` and `relativeTime` come from the loader's shared module table — `@deepseek-ai/dsh-client-ui-primitives`, declared as an `external` in `build.mjs` — instead of being bundled or installed as a dependency, so the tree uses the same controls and metrics as the shipped sidebar.

### Editing the browser half

The client module system accepts one bundle per package — `dsh.client` has no multi-entry form — so the source is a directory and a build step produces the served file:

```
npm install
npm run build     # one shot: src/client/ -> client.js
npm run watch     # rebuild on change while editing
```

`dsh-client-hmr` watches `client.js`, so a rebuild hot-swaps the browser half without restarting the Harness; only a `dsh.client` metadata change (or a new package) needs `systemctl restart dsharness`.

## Notes

- Session titles come from the persisted projection cache; a Session that never got a title shows as *Untitled*.
- A Session with no turns yet is hidden until it becomes the open Session, the same rule the shipped sidebar applies.
- Archived Sessions are hidden unless **Show archived** is on. Archiving a Session that still has work in progress asks to stop that work first (the shipped behaviour); an archived row cannot be opened until you unarchive it.
- Section icons are hardcoded by section id in the settings shell and plugins cannot supply one, so the plugin swaps the gear on its own nav row for a tree mark: it marks the row whose label matches its localized section name and draws the glyph as a CSS mask (`src/client/nav-icon.js`). The shell itself is untouched, and the mark and stylesheet go away with the plugin.

## License

MIT — see [LICENSE](LICENSE).
