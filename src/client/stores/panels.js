/**
 * The "panel entries visible" preference.
 *
 * The panel list (插件 / 插件市场 / QQ 机器人 / …) is ui-sidebar's own `nav`
 * above the browsing region. With the custom sidebar it stays visible by
 * default; the workspace header's toggle hides it when the user wants the tree
 * to start at the top. Browser-local, like the shell override.
 */
import { createStore } from './create-store.js';

/** `localStorage` key holding the preference. */
export const PANELS_KEY = 'session-admin.panels-visible';

/**
 * Read the stored preference; panels show unless the user turned them off.
 * @returns whether the panel list should stay visible.
 */
function readStored() {
	try {
		return localStorage.getItem(PANELS_KEY) !== '0';
	} catch {
		return true;
	}
}

const store = createStore(readStored());

/**
 * Read the preference without subscribing.
 * @returns whether the panel list is shown.
 */
export function getPanelsVisible() {
	return store.get();
}

/**
 * Store the preference and wake every subscriber.
 * @param next - whether the panel list should be shown.
 */
export function setPanelsVisible(next) {
	if (next === store.get()) return;
	store.set(next);
	try {
		localStorage.setItem(PANELS_KEY, next ? '1' : '0');
	} catch {
		/* private mode: the preference stays for this page only */
	}
}

/**
 * Subscribe one listener to the preference, for callers outside React.
 * @param listener - callback invoked after each change.
 * @returns the disposer removing this listener.
 */
export function subscribePanels(listener) {
	return store.subscribe(listener);
}

/**
 * Subscribe one component to the preference.
 * @returns whether the panel list is shown.
 */
export function usePanelsVisible() {
	return store.useValue();
}
