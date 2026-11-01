/**
 * The stored Session tree layout. Both seats read this one store, so the
 * settings page and the sidebar agree while either is open.
 */
import { getTree, postLayout } from '../api.js';
import { emptyLayout, normalizeLayout } from '../layout.js';
import { createStore } from './create-store.js';

const INITIAL = { loaded: false, loading: false, saving: false, error: '', layout: emptyLayout() };

const store = createStore(INITIAL);

/** In-flight read shared by every caller that asks at the same time. */
let inflight = null;

/** Writes run one at a time, so a quick second drag never overtakes the first. */
let writes = Promise.resolve();

/**
 * Fill in the keys of Workspaces the layout has never seen, so the next save
 * carries the whole order. The store keeps this merged view, so a reload shows
 * the same grouping the user just saw.
 * @param layout - stored layout.
 * @param workspaceIds - Workspace ids from the native snapshot.
 * @returns the merged layout.
 */
export function adoptWorkspaces(layout, workspaceIds) {
	const known = new Set(workspaceIds);
	const order = layout.order.filter((key) => {
		if (!key.startsWith('工作区:')) return true;
		return known.has(key.slice('工作区:'.length));
	});
	for (const id of workspaceIds) {
		const key = `工作区:${id}`;
		if (!order.includes(key)) order.push(key);
	}
	return order.length === layout.order.length && order.every((key, index) => key === layout.order[index])
		? layout
		: { ...layout, order };
}

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
