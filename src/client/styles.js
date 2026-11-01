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
.sa-list { border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow: hidden; }
.sa-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-top: 0.5px solid var(--dsw-alias-border-l1); }
.sa-row:first-child { border-top: none; }
.sa-row:hover { background: var(--dsw-alias-bg-layer-1); }
.sa-check { margin: 2px 0 0; flex: none; }
.sa-main { flex: 1; min-width: 0; }
.sa-title { display: flex; align-items: center; gap: 6px; font-size: 13px; line-height: 18px; min-width: 0; }
.sa-title-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sa-meta { margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sa-tag { flex: none; font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.sa-tag-running { color: var(--dsw-alias-state-warn-primary); }
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
.sa-dialog { width: 380px; max-width: calc(100vw - 48px); padding: 20px; display: flex; flex-direction: column; gap: 10px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-elevation-prominent); color: var(--dsw-alias-label-primary); }
.sa-dialog-title { font-size: 15px; line-height: 22px; font-weight: 600; }
.sa-dialog-body { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.sa-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.sa-toast { position: fixed; left: 50%; bottom: 28px; z-index: 1200; transform: translateX(-50%); padding: 8px 14px; max-width: min(560px, calc(100vw - 48px)); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-overlay); box-shadow: var(--dsw-elevation-prominent); font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.sa-toast-error { color: var(--dsw-alias-state-error-primary); }
`;
