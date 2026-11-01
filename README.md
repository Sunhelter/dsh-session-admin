# dsh-session-admin

A small plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) that adds **permanent Session deletion**, which the stock Web UI does not offer (it only archives Sessions).

Tested against DSH `0.2.1-rc.5` with the `web` profile.

## What it adds

| Surface | What you get |
|---|---|
| Settings → **Sessions** | Every stored, unarchived Session with its title, working directory and update time. Search, select rows, select all, then delete in bulk behind one confirmation. Running Sessions are not selectable. |
| Session row **`...` menu** | A red **Delete session** row that confirms one Session and deletes it. |
| Agent tool `session_admin` | `action: "list"` returns id, title, directory, creation time, size and running state; `action: "delete"` removes the given ids. Lets you clean up by asking the agent instead of clicking. |

All three callers share one Host-side operation.

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
- **The sidebar keeps showing a deleted row until the Host restarts.** The Workspace registry builds its session index at startup and caches membership in memory; it does not re-read the persistence root. The settings page drops deleted rows immediately, but the sidebar row, its hover card and any open reference stay stale until a restart. The durable `workspace.json` still lists the id; the next startup filters it out and the next Workspace mutation prunes it.
- **A Session that exists only in memory cannot be deleted.** If a Session's files were removed by something else while the Host kept the object alive, the Host still lists it; the plugin reports "no session files on disk" for it, and only a restart clears it.

## Security

The browser half posts to a plugin-owned route:

```
POST /plugins/session-admin/delete   {"ids": ["session-...", "..."]}
```

The route runs `ctx.connection.requestRejection()` first, so it applies DSH's Host/Origin checks and browser authentication to plugin routes: an unauthenticated request gets `401`, a cross-origin one `403`. Ids are validated against the Session-id shape, duplicates are dropped, a request is capped at 500 ids and 64 KiB.

It still inherits the deployment's own exposure: a DSH instance that anyone on the network can drive without authentication can also drive this route.

## Layout

| File | Role |
|---|---|
| `index.js` | Host half: delete route, session scanning, the `session_admin` agent tool. |
| `src/client/` | Browser-half source: `index.js` entry, `apply.js` seat registrations, `i18n.js`, `styles.js`, `api.js`, `format.js`, `stores/`, `components/`. |
| `client.js` | **Generated** bundle of `src/client/` — the file the Host serves. Never edit it by hand. |
| `build.mjs` | esbuild wrapper that emits `client.js` (`npm run build`, or `npm run watch`). |
| `cordis.patch.yml` | Bundle patch that inserts the Host row. |
| `locale/en.json`, `locale/zh.json` | Plugin-manager display metadata (title, description). |
| `icon.svg` | Plugin artwork. |

The browser half uses only the public client surfaces — no DSH client package is imported at runtime, and React comes from the loader's shared module table (declared as an `external` in `build.mjs`) instead of being bundled. Menu styling follows the shipped menu primitives (row metrics, icon weight, danger tokens) so the extra row looks native.

### Editing the browser half

The client module system accepts one bundle per package — `dsh.client` has no multi-entry form — so the source is a directory and a build step produces the served file:

```
npm install
npm run build     # one shot: src/client/ -> client.js
npm run watch     # rebuild on change while editing
```

`dsh-client-hmr` watches `client.js`, so a rebuild hot-swaps the browser half without restarting the Harness; only a `dsh.client` metadata change (or a new package) needs `systemctl restart dsharness`.

## Notes

- Session titles come from the persisted projection cache; a Session that never got a title shows as *Untitled* and is tagged *Empty* when it has no content.
- Archived Sessions are hidden from the settings list; restore one in the sidebar to manage it.
- The settings section uses the settings shell's default gear icon, because section icons are hardcoded by section id in the shell and plugins cannot supply one.

## License

MIT — see [LICENSE](LICENSE).
