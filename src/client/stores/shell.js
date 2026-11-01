/**
 * The "replace the native sidebar" preference.
 *
 * It is a browser-local view preference, not plugin configuration: it lives in
 * `localStorage`, it is per browser, and the settings page and the sidebar
 * registration both read this one store so a toggle takes effect without a
 * page reload.
 */
import { createStore } from './create-store.js';

/** `localStorage` key holding the preference. */
export const SHELL_KEY = 'session-admin.shell-override';

/**
 * Read the stored preference.
 * @returns whether the custom sidebar is enabled.
 */
function readStored() {
	try {
		return localStorage.getItem(SHELL_KEY) === '1';
	} catch {
		return false;
	}
}

const store = createStore(readStored());

/**
 * Read the preference without subscribing.
 * @returns whether the custom sidebar is enabled.
 */
export function getShellOverride() {
	return store.get();
}

/**
 * Store the preference and wake every subscriber.
 * @param next - whether the custom sidebar should render.
 */
export function setShellOverride(next) {
	if (next === store.get()) return;
	store.set(next);
	try {
		localStorage.setItem(SHELL_KEY, next ? '1' : '0');
	} catch {
		/* private mode: the preference stays for this page only */
	}
}

/**
 * Subscribe one listener to the preference, for callers outside React.
 * @param listener - callback invoked after each change.
 * @returns the disposer removing this listener.
 */
export function subscribeShell(listener) {
	return store.subscribe(listener);
}

/**
 * Subscribe one component to the preference.
 * @returns whether the custom sidebar is enabled.
 */
export function useShellOverride() {
	return store.useValue();
}
