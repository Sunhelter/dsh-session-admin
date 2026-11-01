/** Same-origin Host route this plugin owns for Session deletion. */
export const DELETE_URL = '/plugins/session-admin/delete';

/** Same-origin Host route returning the stored Session tree. */
export const TREE_URL = '/plugins/session-admin/tree';

/**
 * Read the stored tree: folders with their Session ids, plus the dangling
 * links the Host removed while reading.
 * @returns the folders, the removed links, or one failure message.
 */
export async function getTree() {
	try {
		const response = await fetch(TREE_URL, { credentials: 'same-origin' });
		const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
		if (data.ok !== true) return { ok: false, error: data.error ?? `HTTP ${response.status}` };
		const folders = Array.isArray(data.folders)
			? data.folders.map((folder) => ({
					name: typeof folder?.name === 'string' ? folder.name : '',
					sessions: Array.isArray(folder?.sessions) ? folder.sessions.filter((id) => typeof id === 'string') : [],
				}))
			: [];
		return {
			ok: true,
			folders: folders.filter((folder) => folder.name !== ''),
			invalid: Array.isArray(data.invalid) ? data.invalid : [],
		};
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
