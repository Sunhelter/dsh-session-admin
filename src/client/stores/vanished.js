/**
 * Session ids this browser has already deleted.
 *
 * The Host's catalog keeps a row for a live Session until the process
 * restarts, even when its log directory is gone, so the deletions outlive the
 * page: a reload must not bring the row back. An id is forgotten once the
 * catalog stops listing it, which is what a Host restart eventually does.
 */
import { orderedUnique } from '../format.js';
import { createStore } from './create-store.js';

/** `localStorage` key holding the deleted Session ids. */
export const VANISHED_KEY = 'session-admin.vanished';

/** Session ids are the `session-<uuid>` strings the store mints. */
const SESSION_ID = /^session-[0-9a-fA-F-]{8,64}$/;

/**
 * Read the stored deleted ids, dropping anything that is not a Session id.
 * @returns deleted ids, in deletion order.
 */
function readStored() {
	try {
		const raw = JSON.parse(localStorage.getItem(VANISHED_KEY) ?? '[]');
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
 * Write the list through; private mode keeps the deletions for this page only.
 * @param ids - ids to store.
 */
function writeStored(ids) {
	try {
		localStorage.setItem(VANISHED_KEY, JSON.stringify(ids));
	} catch {
		/* private mode: the deletions stay for this page only */
	}
}

/**
 * Publish deleted ids to every mounted surface.
 * @param ids - ids the Host confirmed as deleted.
 */
export function markVanished(ids) {
	const valid = ids.filter((id) => SESSION_ID.test(id));
	if (valid.length === 0) return;
	const current = store.get();
	const next = orderedUnique([...current, ...valid]);
	if (next.length === current.length) return;
	store.set(next);
	writeStored(next);
}

/**
 * Forget the ids the catalog no longer lists, so a Host restart clears its own
 * leftovers instead of leaving them hidden here forever.
 * @param presentIds - ids in the current catalog.
 */
export function pruneVanished(presentIds) {
	const present = new Set(presentIds);
	const current = store.get();
	const next = current.filter((id) => present.has(id));
	if (next.length === current.length) return;
	store.set(next);
	writeStored(next);
}

/**
 * Subscribe one component to the deleted-id list.
 * @returns the current deleted ids.
 */
export function useVanished() {
	return store.useValue();
}
