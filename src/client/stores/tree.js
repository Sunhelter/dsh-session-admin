/**
 * The stored Session tree layout. Both seats read this one store, so the
 * settings page and the sidebar agree while either is open.
 */
import { getTree, postLayout } from '../api.js';
import { adoptWorkspaces, emptyLayout, normalizeLayout } from '../layout.js';
import { createStore } from './create-store.js';

export { adoptWorkspaces };

const INITIAL = { loaded: false, loading: false, saving: false, error: '', layout: emptyLayout() };

const store = createStore(INITIAL);

/** In-flight read shared by every caller that asks at the same time. */
let inflight = null;

/** Writes run one at a time, so a quick second drag never overtakes the first. */
let writes = Promise.resolve();

/**
 * Fetch the layout once more. Concurrent callers share one request.
 * @returns the settled store value.
 */
export function refreshLayout() {
	if (inflight !== null) return inflight;
	store.set({ ...store.get(), loading: true, error: '' });
	inflight = getTree()
		.then((result) => {
			if (result.ok !== true) {
				store.set({ ...store.get(), loading: false, error: result.error });
				return store.get();
			}
			store.set({ loaded: true, loading: false, error: '', layout: result.layout });
			return store.get();
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Persist a layout the caller already computed. The store updates first, so
 * the tree moves immediately; a failed save reloads the stored layout.
 * @param next - layout to store.
 * @returns the settled store value.
 */
export function saveLayout(next) {
	const previous = store.get();
	const layout = normalizeLayout(next);
	store.set({ ...previous, saving: true, error: '', layout });
	writes = writes.then(async () => {
		const result = await postLayout(store.get().layout);
		const current = store.get();
		if (result.ok !== true) {
			const fallback = current.layout === layout ? previous.layout : current.layout;
			store.set({ ...current, saving: false, error: result.error, layout: fallback });
			return store.get();
		}
		store.set({ ...current, loaded: true, saving: false, error: '', layout: result.layout });
		return store.get();
	});
	return writes;
}

/**
 * Subscribe one component to the layout store.
 * @returns the current store value.
 */
export function useTree() {
	return store.useValue();
}
