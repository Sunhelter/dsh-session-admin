/**
 * Pinned Session ids.
 *
 * Pinning is a browser-local view preference, like the sidebar override: it
 * lives in `localStorage`, it is per browser, and both seats read this one
 * store so a pin takes effect without a page reload.
 */
import { createStore } from './create-store.js';

/** `localStorage` key holding the pinned Session ids, most recent first. */
export const PINS_KEY = 'session-admin.pinned';

/** Session ids are the `session-<uuid>` strings the store mints. */
const SESSION_ID = /^session-[0-9a-fA-F-]{8,64}$/;

/**
 * Read the stored pins, dropping anything that is not a Session id.
 * @returns pinned ids, in display order.
 */
function readStored() {
	try {
		const raw = JSON.parse(localStorage.getItem(PINS_KEY) ?? '[]');
		if (!Array.isArray(raw)) return [];
		const list = [];
		for (const value of raw) {
			if (typeof value !== 'string' || !SESSION_ID.test(value) || list.includes(value)) continue;
			list.push(value);
		}
		return list;
	} catch {
		return [];
	}
}

const store = createStore(readStored());

/**
 * Read the pins without subscribing.
 * @returns pinned ids, in display order.
 */
export function getPinned() {
	return store.get();
}

/**
 * Flip one Session's pinned state and wake every subscriber.
 * @param id - Session id.
 */
export function togglePin(id) {
	const current = store.get();
	const next = current.includes(id) ? current.filter((value) => value !== id) : [id, ...current];
	store.set(next);
	try {
		localStorage.setItem(PINS_KEY, JSON.stringify(next));
	} catch {
		/* private mode: the pins stay for this page only */
	}
}

/**
 * Subscribe one component to the pins.
 * @returns pinned ids, in display order.
 */
export function usePinned() {
	return store.useValue();
}
