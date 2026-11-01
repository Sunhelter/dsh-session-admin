/**
 * The stored Session tree: folders holding Session ids. Both seats read this
 * one store, so the settings page and the sidebar agree while either is open.
 */
import { getTree } from '../api.js';
import { createStore } from './create-store.js';

const INITIAL = { loaded: false, loading: false, error: '', folders: [], invalid: [] };

const store = createStore(INITIAL);

/** In-flight request shared by every caller that asks at the same time. */
let inflight = null;

/**
 * Fetch the tree once more. Concurrent callers share one request.
 * @returns the settled tree value.
 */
export function refreshTree() {
	if (inflight !== null) return inflight;
	store.set({ ...store.get(), loading: true, error: '' });
	inflight = getTree()
		.then((result) => {
			if (result.ok !== true) {
				store.set({ ...store.get(), loading: false, error: result.error });
				return store.get();
			}
			store.set({ loaded: true, loading: false, error: '', folders: result.folders, invalid: result.invalid });
			return store.get();
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Subscribe one component to the tree.
 * @returns the current tree value.
 */
export function useTree() {
	return store.useValue();
}
