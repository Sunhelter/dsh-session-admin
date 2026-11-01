import { normalizeLayout } from './layout.js';

/** Same-origin Host route this plugin owns for Session deletion. */
export const DELETE_URL = '/plugins/session-admin/delete';

/** Same-origin Host route returning the stored Session tree layout. */
export const TREE_URL = '/plugins/session-admin/tree';

/** Same-origin Host route replacing the stored Session tree layout. */
export const LAYOUT_URL = '/plugins/session-admin/layout';

/**
 * Read the stored tree layout.
 * @returns the normalized layout, or one failure message.
 */
export async function getTree() {
	try {
		const response = await fetch(TREE_URL, { credentials: 'same-origin' });
		const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
		if (data.ok !== true) return { ok: false, error: data.error ?? `HTTP ${response.status}` };
		return { ok: true, layout: normalizeLayout(data.layout) };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Replace the stored tree layout.
 * @param layout - the layout to persist.
 * @returns the layout the Host stored, or one failure message.
 */
export async function postLayout(layout) {
	try {
		const response = await fetch(LAYOUT_URL, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ layout }),
		});
		const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
		if (data.ok !== true) return { ok: false, error: data.error ?? `HTTP ${response.status}` };
		return { ok: true, layout: normalizeLayout(data.layout) };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Ask the Host to delete Sessions. The settings page and the row menu share
 * this one call; both read the same `{ ok, deleted, skipped }` shape.
 * @param ids - session ids to delete.
 * @returns the Host result, or one failure message.
 */
export async function postDelete(ids) {
	try {
		const response = await fetch(DELETE_URL, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ids }),
		});
		const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
		if (data.ok !== true) return { ok: false, error: data.error ?? `HTTP ${response.status}` };
		return {
			ok: true,
			deleted: Array.isArray(data.deleted) ? data.deleted : [],
			skipped: Array.isArray(data.skipped) ? data.skipped : [],
		};
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}
