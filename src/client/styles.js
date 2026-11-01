/**
 * Stylesheet shared by every surface this plugin renders: the settings page,
 * the Session row menu item, and the frame-wide confirmation/notice overlay.
 *
 * Class prefixes stay `sa-` so the three seats never collide with a shipped
 * `dsw-` class, and colors ride the theme alias tokens rather than literals.
 */
export const CSS = `
.sa-root { width: 100%; max-width: 760px; display: flex; flex-direction: column; gap: 14px; color: var(--dsw-alias-label-primary); }
.sa-head h2 { margin: 0 0 4px; font-size: 15px; line-height: 22px; font-weight: 600; }
.sa-desc { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.sa-pref { display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
.sa-pref-text { flex: 1; min-width: 0; }
.sa-pref-label { font-size: 13px; line-height: 18px; font-weight: 500; }
.sa-pref-desc { margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
.sa-switch { position: relative; flex: none; width: 34px; height: 20px; margin-top: 1px; padding: 0; border: none; border-radius: 999px; background: var(--dsw-alias-border-l3); cursor: pointer; transition: background 0.12s ease; }
.sa-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 999px; background: var(--dsw-alias-switch-thumb, #fff); transition: transform 0.12s ease; }
.sa-switch[aria-checked="true"] { background: var(--dsw-alias-state-business-primary); }
.sa-switch[aria-checked="true"]::after { transform: translateX(14px); }
.sa-switch:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .sa-switch, .sa-switch::after { transition: none; } }
.sa-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sa-search { flex: 1 1 220px; min-width: 160px; height: 30px; padding: 0 10px; border-radius: 6px; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 13px; }
.sa-search::placeholder { color: var(--dsw-alias-label-secondary); }
.sa-btn { height: 30px; padding: 0 12px; border-radius: 6px; border: 0.5px solid var(--dsw-alias-border-l2); background: transparent; color: inherit; font: inherit; font-size: 13px; line-height: 28px; cursor: pointer; }
.sa-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.sa-btn:disabled { opacity: 0.45; cursor: default; }
.sa-btn-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.sa-btn-danger:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.sa-btn-danger-solid { border-color: transparent; background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-bg-base); }
.sa-btn-danger-solid:hover:not(:disabled) { background: var(--dsw-alias-state-error-primary); opacity: 0.9; }
.sa-count { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.sa-tree { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }
.sa-block { display: flex; flex-direction: column; }
.sa-group { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 8px; border-radius: var(--dsw-radius-md); cursor: pointer; user-select: none; color: var(--dsw-alias-label-primary); }
.sa-group:hover, .sa-group.sa-menu-open { background: var(--dsw-alias-interactive-bg-hover); }
.sa-slot { width: 16px; height: 20px; flex: none; display: inline-flex; align-items: center; justify-content: center; color: var(--dsw-alias-label-tertiary); }
.sa-group .sa-chevron { display: none; }
.sa-group:hover .sa-chevron { display: inline-flex; }
.sa-group:hover .sa-folder { display: none; }
.sa-arrow { transition: transform 0.15s var(--ds-ease-in-out); }
.sa-arrow-open { transform: rotate(90deg); }
.sa-title { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 14px; line-height: 20px; }
.sa-row-actions { flex: none; display: none; align-items: center; gap: 12px; }
.sa-group:hover .sa-row-actions, .sa-group.sa-menu-open .sa-row-actions, .sa-session:hover .sa-row-actions, .sa-session.sa-menu-open .sa-row-actions { display: inline-flex; }
.sa-icon-btn { width: 16px; height: 16px; padding: 0; border: none; border-radius: var(--dsw-radius-xs); background: transparent; color: var(--dsw-alias-label-tertiary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.sa-icon-btn:hover { color: var(--dsw-alias-label-primary); }
.sa-rows { display: flex; flex-direction: column; }
.sa-session { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px 0 10px; border-radius: var(--dsw-radius-md); color: var(--dsw-alias-label-primary); }
.sa-session:hover, .sa-session.sa-menu-open { background: var(--dsw-alias-interactive-bg-hover); }
.sa-session.sa-selected { background: var(--dsw-alias-interactive-bg-hover); }
.sa-check { flex: none; width: 14px; height: 14px; margin: 0; accent-color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.sa-open { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 0; border: none; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.sa-open:disabled { cursor: default; opacity: 0.6; }
.sa-open .sa-title { flex: 0 1 auto; }
.sa-dot { flex: none; width: 6px; height: 6px; border-radius: 999px; background: var(--dsw-alias-state-business-primary); }
.sa-dot-done { background: var(--dsw-alias-state-warn-primary); }
.sa-time { flex: none; color: var(--dsw-alias-label-tertiary); font-size: 10px; line-height: 16px; }
.sa-session:hover .sa-time, .sa-session.sa-menu-open .sa-time { display: none; }
.sa-pinned { display: flex; flex-direction: column; gap: 2px; padding-bottom: 2px; }
.sa-pinned-entry { display: flex; flex-direction: column; }
.sa-pinned-row { padding-left: 10px; }
.sa-pin { color: var(--dsw-alias-label-secondary); }
.sa-group.sa-drop-target { background: var(--dsw-alias-interactive-bg-hover); outline: 1px dashed var(--dsw-alias-state-business-primary); outline-offset: -1px; }
.sa-pinned-entry.sa-drop-before { box-shadow: inset 0 2px 0 0 var(--dsw-alias-state-business-primary); }
.sa-pinned-entry.sa-drop-after { box-shadow: inset 0 -2px 0 0 var(--dsw-alias-state-business-primary); }
.sa-pinned-tail { height: 6px; }
.sa-pinned-tail:hover { box-shadow: inset 0 2px 0 0 var(--dsw-alias-state-business-primary); }
.sa-btn-active { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-state-business-primary); color: var(--dsw-alias-state-business-primary); }
.sa-tag { flex: none; padding: 0 6px; border-radius: var(--dsw-radius-sm, 4px); font-size: 10px; line-height: 16px; color: var(--dsw-alias-label-tertiary); background: var(--dsw-alias-interactive-bg-hover); }
.sa-session.sa-archived .sa-title { color: var(--dsw-alias-label-tertiary); }
.sa-session.sa-drop-before { box-shadow: inset 0 2px 0 0 var(--dsw-alias-state-business-primary); }
.sa-group[draggable="true"], .sa-session[draggable="true"] { cursor: grab; }
.sa-empty-group { padding: 4px 8px 8px 30px; font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary); }
.sa-tree-sidebar { padding: 0; gap: 0; }
.sa-tree-sidebar .sa-session-sidebar { width: 100%; padding: 0 8px 0 10px; border: none; background: transparent; font: inherit; text-align: left; cursor: pointer; }
.sa-tree-sidebar .sa-session-sidebar:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.sa-tree-sidebar .sa-session-sidebar:disabled { cursor: default; opacity: 0.6; }
.sa-tree-sidebar .sa-time { font-size: 10px; }
.sa-sidebar-tree { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; padding: 0 2px; box-sizing: border-box; }
.sa-sidebar-tree .sa-tree { gap: 2px; }
.sa-sidebar-tree .sa-shell-empty { padding: 12px 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.sa-sidebar-tree .sa-ws-header { display: flex; align-items: center; justify-content: flex-end; gap: 4px; height: 36px; margin: 2px 0 4px; padding: 0 4px 0 8px; color: var(--dsw-alias-label-tertiary); box-sizing: border-box; }
.sa-sidebar-tree .sa-ws-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px; font-weight: 500; }
.sa-sidebar-tree .sa-ws-actions { display: flex; align-items: center; gap: 2px; }
.sa-sidebar-tree .sa-ws-icon-btn,
.sa-sidebar-tree .sa-ws-search-btn,
.sa-sidebar-tree .sa-ws-search-clear { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--dsw-radius-md); background: transparent; color: inherit; cursor: pointer; }
.sa-sidebar-tree .sa-ws-icon-btn:hover,
.sa-sidebar-tree .sa-ws-search-btn:hover,
.sa-sidebar-tree .sa-ws-search-clear:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.sa-sidebar-tree .sa-ws-search { display: flex; align-items: center; flex: 0 1 auto; max-width: 28px; min-width: 0; transition: max-width 140ms ease; }
.sa-sidebar-tree .sa-ws-search-expanded { flex: 1 1 auto; max-width: 100%; height: 30px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); padding: 0 2px 0 0; }
.sa-sidebar-tree .sa-ws-search-input { flex: 1 1 auto; min-width: 0; height: 100%; padding: 0 0 0 6px; border: 0; background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 18px; outline: none; }
.sa-sidebar-tree .sa-ws-search-input::placeholder { color: var(--dsw-alias-label-tertiary); }
[data-session-admin-sidebar] > nav { display: none; }
.sa-sidebar-tree .sa-group { height: 32px; padding: 0 8px; }
.sa-sidebar-tree .sa-session { width: 100%; box-sizing: border-box; height: 32px; padding: 0 8px 0 10px; }
.sa-sidebar-tree .sa-title { font-size: 14px; line-height: 20px; }
.sa-sidebar-tree .sa-time { font-size: 11px; line-height: 15px; }
@media (prefers-reduced-motion: reduce) { .sa-arrow { transition: none; } }
.sa-btn-primary { border-color: transparent; background: var(--dsw-alias-state-business-primary); color: var(--dsw-alias-bg-base); }
.sa-btn-primary:hover:not(:disabled) { background: var(--dsw-alias-state-business-primary); opacity: 0.9; }
.sa-empty { padding: 24px 12px; text-align: center; font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.sa-confirm { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-radius: 8px; border: 0.5px solid var(--dsw-alias-state-error-primary); font-size: 13px; line-height: 18px; }
.sa-confirm-text { flex: 1 1 220px; min-width: 0; }
.sa-confirm-body { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; }
.sa-notice { font-size: 13px; line-height: 18px; }
.sa-notice-ok { color: var(--dsw-alias-state-success-primary); }
.sa-notice-error { color: var(--dsw-alias-state-error-primary); }
.sa-hint { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
.sa-itemWrap { position: relative; }
.sa-item { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; padding: 6px 8px; border: none; border-radius: var(--dsw-radius-md); background: transparent; cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); text-align: left; }
.sa-item:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.sa-item:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); outline: none; }
.sa-item:disabled { opacity: 0.4; cursor: not-allowed; }
.sa-itemIcon { display: inline-flex; flex: none; width: 14px; height: 14px; align-items: center; justify-content: center; color: var(--dsw-alias-menu-icon); }
.sa-itemIcon svg { width: 14px; height: 14px; }
.sa-itemLabel { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-item-danger, .sa-item-danger .sa-itemIcon { color: var(--dsw-alias-state-error-primary); }
.sa-item-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.sa-item-danger:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); outline: none; }
.sa-mask { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur); }
.sa-picker { width: min(460px, calc(100vw - 64px)); }
.sa-picker-body { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.sa-picker-crumbs { display: flex; flex-wrap: wrap; gap: 2px; max-height: 54px; overflow-y: auto; }
.sa-picker-crumb { padding: 0 4px; border: 0; border-radius: var(--dsw-radius-xs); background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; }
.sa-picker-crumb:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.sa-picker-crumb-current { color: var(--dsw-alias-label-primary); }
.sa-picker-list { display: flex; flex-direction: column; max-height: 240px; overflow-y: auto; }
.sa-picker-row { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 6px; border: 0; border-radius: var(--dsw-radius-md); background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.sa-picker-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sa-picker-folder { flex: none; width: 12px; color: var(--dsw-alias-label-tertiary); }
.sa-picker-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-picker-status { padding: 6px 4px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.sa-input { width: 100%; height: 30px; box-sizing: border-box; padding: 0 10px; border-radius: 6px; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 13px; }
.sa-dialog { width: 380px; max-width: calc(100vw - 48px); padding: 20px; display: flex; flex-direction: column; gap: 10px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-elevation-prominent); color: var(--dsw-alias-label-primary); }
.sa-dialog-title { font-size: 15px; line-height: 22px; font-weight: 600; }
.sa-dialog-body { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.sa-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.sa-toast { position: fixed; left: 50%; bottom: 28px; z-index: 1200; transform: translateX(-50%); padding: 8px 14px; max-width: min(560px, calc(100vw - 48px)); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-overlay); box-shadow: var(--dsw-elevation-prominent); font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.sa-toast-error { color: var(--dsw-alias-state-error-primary); }
`;
