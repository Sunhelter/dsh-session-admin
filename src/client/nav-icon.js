/**
 * The plugin's glyph in the settings navigation.
 *
 * The settings shell picks nav glyphs from a closed list of section ids and
 * falls back to its gear for every other id; `settings.section` projects only
 * `id` / `order` / `label`, so a registrant has no icon to pass. A third-party
 * section therefore claims its own row once the dialog is mounted and swaps
 * the fallback gear for the tree mark — the same mark the page itself is about.
 *
 * Scope, deliberately narrow:
 * - only the row whose visible text equals this plugin's own localized section
 *   label is marked; no shell structure is touched;
 * - the marker and the injected stylesheet belong to a `ctx.effect`, so they
 *   are removed with the fiber;
 * - a locale switch re-claims the row through the MutationObserver, so the
 *   label and the glyph never disagree.
 *
 * Delete this module the day `settings.section` grows an `icon` field.
 */

/** Marks the one nav row this plugin owns. */
const NAV_ICON_MARKER = 'data-session-admin-nav-icon';

/**
 * The nav rows of the settings dialog. The shell renders each
 * `settings.section` entry as a `<button>` inside the panel's `<nav>`
 * (SettingsPanel in dsh-client-ui-settings-general).
 */
const NAV_ROW_SELECTOR = '[role="dialog"] nav button';

/**
 * The mark as standalone SVG for a CSS `mask-image`.
 *
 * Painted pure black on purpose: a mask reads alpha only, and the visible
 * colour comes from `background-color: currentColor`. It draws a small tree:
 * one trunk, two branches, two leaves.
 * @returns the SVG source.
 */
function markSvg() {
	const leaf = 'rx="1"';
	return [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#000">',
		'<rect x="2" y="3" width="1.5" height="10" rx="0.75"/>',
		'<rect x="3" y="5.25" width="6" height="1.5" rx="0.75"/>',
		'<rect x="3" y="9.25" width="8.5" height="1.5" rx="0.75"/>',
		'<rect x="8.5" y="3.5" width="5.5" height="4.5" ' + leaf + '/>',
		'<rect x="11" y="7.5" width="3" height="3.5" ' + leaf + '/>',
		'</svg>',
	].join('');
}

/**
 * The mask URL for the mark (encoded at runtime, never hand-escaped).
 * @returns a data URI usable in `mask-image`.
 */
function maskUrl() {
	return 'data:image/svg+xml,' + encodeURIComponent(markSvg());
}

/**
 * Whether a nav row is this plugin's own.
 *
 * Pure, and the only decision this feature makes: the row whose visible text
 * is the section label the shell is currently projecting. An empty label
 * matches nothing — a locale that has not resolved yet must not mark the
 * whole nav.
 * @param rowText - the row's text content.
 * @param wantedLabel - this plugin's current section label.
 * @returns whether the row belongs to this plugin.
 */
export function isOwnNavRow(rowText, wantedLabel) {
	const wanted = String(wantedLabel ?? '').trim();
	if (wanted.length === 0) return false;
	return String(rowText ?? '').trim() === wanted;
}

/**
 * Stylesheet for the marked row: hide the shell's gear, draw the mark.
 * @param url - the mask data URI.
 * @returns the CSS text.
 */
function navIconCss(url) {
	return [
		`[${NAV_ICON_MARKER}] > svg { display: none; }`,
		`[${NAV_ICON_MARKER}]::before {`,
		`  content: '';`,
		`  flex: none;`,
		`  width: 16px;`,
		`  height: 16px;`,
		`  background-color: currentColor;`,
		`  -webkit-mask-image: url("${url}");`,
		`  mask-image: url("${url}");`,
		`  -webkit-mask-repeat: no-repeat;`,
		`  mask-repeat: no-repeat;`,
		`  -webkit-mask-position: center;`,
		`  mask-position: center;`,
		`  -webkit-mask-size: 16px 16px;`,
		`  mask-size: 16px 16px;`,
		`}`,
	].join('\n');
}

/**
 * Install the nav glyph.
 *
 * @param ctx - client context, for effect ownership.
 * @param resolveLabel - this plugin's current section label (the same thunk
 *   the `settings.section` registration passes), re-read on every sync so a
 *   locale switch is picked up without re-registering.
 */
export function installSettingsNavIcon(ctx, resolveLabel) {
	if (typeof document === 'undefined') return;
	ctx.effect(
		() => {
			const tag = document.createElement('style');
			tag.dataset.plugin = 'session-admin';
			tag.dataset.pluginCss = 'session-admin/settings-nav-icon';
			tag.textContent = navIconCss(maskUrl());
			document.head.appendChild(tag);
			let disposed = false;
			let scheduled = false;
			const sync = () => {
				scheduled = false;
				if (disposed) return;
				const wanted = resolveLabel();
				for (const row of document.querySelectorAll(NAV_ROW_SELECTOR)) {
					if (isOwnNavRow(row.textContent, wanted)) row.setAttribute(NAV_ICON_MARKER, '');
					else row.removeAttribute(NAV_ICON_MARKER);
				}
			};
			const schedule = () => {
				if (scheduled || disposed) return;
				scheduled = true;
				queueMicrotask(sync);
			};
			sync();
			const observer = new MutationObserver(schedule);
			observer.observe(document.body, { childList: true, subtree: true, characterData: true });
			return () => {
				disposed = true;
				observer.disconnect();
				for (const row of document.querySelectorAll(`[${NAV_ICON_MARKER}]`)) row.removeAttribute(NAV_ICON_MARKER);
				tag.remove();
			};
		},
		'session-admin: settings nav icon',
	);
}
