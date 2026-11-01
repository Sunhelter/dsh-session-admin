/**
 * Session ids this browser has already deleted. The Host's session catalog
 * keeps such a row until it refreshes, so every surface filters these out.
 */
import { orderedUnique } from '../format.js';
import { createStore } from './create-store.js';

const store = createStore([]);

/**
 * Publish deleted ids to every mounted surface.
 * @param ids - ids the Host confirmed as deleted.
 */
export function markVanished(ids) {
	if (ids.length === 0) return;
	store.set(orderedUnique([...store.get(), ...ids]));
}

/**
 * Subscribe one component to the deleted-id list.
 * @returns the current deleted ids.
 */
export function useVanished() {
	return store.useValue();
}
