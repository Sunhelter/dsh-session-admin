/**
 * Frame-wide overlay state: one confirmation request or one transient notice.
 * The row menu writes it; the `shell.overlay` seat renders it.
 */
import { createStore } from './create-store.js';

const store = createStore(null);

/**
 * Replace the overlay state.
 * @param next - confirm request, a notice, or null to close.
 */
export function setOverlay(next) {
	store.set(next);
}

/**
 * Subscribe one component to the overlay state.
 * @returns the current overlay state.
 */
export function useOverlay() {
	return store.useValue();
}
