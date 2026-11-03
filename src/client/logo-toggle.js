/**
 * The sidebar mode switch injected into the shipped brand row.
 *
 * ui-sidebar owns that row and opens no seat for a control beside its collapse
 * toggle, so the button is created in plain DOM and moved back into the row
 * whenever a re-render drops it. It is hidden while the sidebar is a rail (the
 * row only has room for the collapse toggle), and its glyph follows the shell
 * preference: the hamburger while the shipped workspace browser is showing, the
 * native folder once our session list replaces it.
 */
import { getShellOverride, setShellOverride, subscribeShell } from './stores/shell.js';

const BUTTON_ATTR = 'data-session-admin-logo-toggle';
/** Rail rows are ~36px wide; the expanded row is always wider than this. */
const ROW_MIN_WIDTH = 120;
/** ui-sidebar's labels for its collapse toggle, in both shipped locales. */
const TOGGLE_LABELS = new Set(['收起侧边栏', '打开侧边栏', 'Collapse sidebar', 'Open sidebar']);

const HAMBURGER =
	'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
	'<path d="M2.5 3.5h11M2.5 8h11M2.5 12.5h11" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>' +
	'</svg>';

// The shipped workspace folder icon, path for path.
const FOLDER =
	'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
	'<path d="M1.50439 3.11059C1.50439 2.55831 1.95211 2.1106 2.50439 2.1106H5.43389C5.67773 2.1106 5.91318 2.19969 6.09593 2.36113L7.71649 3.79265C7.89924 3.95409 8.1347 4.04319 8.3785 4.04319H13.4958C14.0481 4.04319 14.4958 4.4909 14.4958 5.04319V12.8894C14.4958 13.4417 14.0481 13.8894 13.4958 13.8894H2.50439C1.95211 13.8894 1.50439 13.4417 1.50439 12.8894V4.04319V3.11059Z" stroke="currentColor" stroke-width="1"/>' +
	'<path d="M3.63501 7.66614H12.3647" stroke="currentColor" stroke-width="1"/>' +
	'</svg>';

/**
 * The shipped collapse toggle: the only button in the app labelled that way.
 * @returns {HTMLElement|null} the toggle, or null while the sidebar is unmounted.
 */
function findToggle() {
	for (const button of document.querySelectorAll('button[aria-label]')) {
		if (TOGGLE_LABELS.has(button.getAttribute('aria-label'))) return button;
	}
	return null;
}

/**
 * Keep one button in the row, directly before the collapse toggle.
 * @returns {HTMLElement|null} the button, or null while the row is unmounted.
 */
function ensureButton() {
	const toggle = findToggle();
	if (toggle === null) return null;
	const row = toggle.parentElement;
	let button = document.querySelector(`button[${BUTTON_ATTR}]`);
	if (button === null) {
		button = document.createElement('button');
		button.type = 'button';
		button.className = 'sa-logo-toggle';
		button.setAttribute(BUTTON_ATTR, '');
		button.addEventListener('click', () => setShellOverride(!getShellOverride()));
	}
	if (button.parentElement !== row || button.nextElementSibling !== toggle) {
		row.insertBefore(button, toggle);
	}
	return button;
}

/**
 * @param labels - current labels: `toSessionList` while the shipped browser
 *   shows, `toNativeSidebar` while our list replaces it.
 * @returns {HTMLElement|null} the button, or null while the row is unmounted.
 */
function sync(labels) {
	const button = ensureButton();
	if (button === null) return null;
	button.hidden = button.parentElement.getBoundingClientRect().width < ROW_MIN_WIDTH;
	const custom = getShellOverride();
	const mode = custom ? 'custom' : 'native';
	if (button.dataset.mode !== mode) {
		button.dataset.mode = mode;
		button.innerHTML = custom ? FOLDER : HAMBURGER;
	}
	const label = custom ? labels.toNativeSidebar : labels.toSessionList;
	if (button.title !== label) {
		button.title = label;
		button.setAttribute('aria-label', label);
	}
	return button;
}

/**
 * @param ctx - plugin context.
 * @param resolveLabels - resolves the two labels above from the active locale.
 */
export function installLogoToggle(ctx, resolveLabels) {
	ctx.effect(() => {
		let frame = 0;
		let observer = null;
		let resizer = null;
		let row = null;
		/** React inserts its own children around ours, so watch the row itself. */
		const watch = (nextRow) => {
			if (row === nextRow) return;
			observer?.disconnect();
			resizer?.disconnect();
			observer = null;
			resizer = null;
			row = nextRow;
			if (row === null) return;
			observer = new MutationObserver(() => schedule());
			observer.observe(row, { childList: true });
			// Collapsing to a rail does not fire a window resize: only this row shrinks.
			resizer = new ResizeObserver(() => schedule());
			resizer.observe(row);
		};
		const run = () => {
			frame = 0;
			const button = sync(resolveLabels());
			watch(button === null ? null : button.parentElement);
		};
		const schedule = () => {
			if (frame === 0) frame = requestAnimationFrame(run);
		};
		schedule();
		const unsubscribe = subscribeShell(schedule);
		const timer = setInterval(run, 2000);
		window.addEventListener('resize', schedule);
		return () => {
			unsubscribe();
			clearInterval(timer);
			window.removeEventListener('resize', schedule);
			observer?.disconnect();
			resizer?.disconnect();
			if (frame !== 0) cancelAnimationFrame(frame);
			document.querySelector(`button[${BUTTON_ATTR}]`)?.remove();
		};
	}, 'session-admin: logo toggle');
}
