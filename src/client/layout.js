/**
 * Pure helpers over the stored tree layout. The Host persists the same shape in
 * `$DSH_HOME/session-admin/tree/layout.json`; this module only normalizes and
 * mutates it, so the tree component never reasons about keys itself.
 *
 * Folder keys are `工作区:<workspaceId>` or `自定义:<name>`; a pinned entry is
 * either such a key or a Session id.
 */
export const WORKSPACE_PREFIX = '工作区:';
export const CUSTOM_PREFIX = '自定义:';

/** Session ids are the `session-<uuid>` strings the store mints. */
const SESSION_ID = /^session-[0-9a-fA-F-]{8,64}$/;

/** @returns a fresh empty layout. */
export function emptyLayout() {
	return { version: 1, order: [], folders: [], placement: {}, pinned: [], sessions: {} };
}

/**
 * @param id - workspace id.
 * @returns the folder key of one Workspace.
 */
export function workspaceKey(id) {
	return WORKSPACE_PREFIX + id;
}

/**
 * @param name - custom folder name.
 * @returns the folder key of one custom folder.
 */
export function customKey(name) {
	return CUSTOM_PREFIX + name;
}

/**
 * @param key - a folder key.
 * @returns `{ kind, value }`, or null when the key is not a folder key.
 */
export function parseKey(key) {
	if (typeof key !== 'string') return null;
	if (key.startsWith(WORKSPACE_PREFIX)) {
		const value = key.slice(WORKSPACE_PREFIX.length);
		return value === '' ? null : { kind: 'workspace', value };
	}
	if (key.startsWith(CUSTOM_PREFIX)) {
		const value = key.slice(CUSTOM_PREFIX.length);
		return value === '' ? null : { kind: 'custom', value };
	}
	return null;
}

/**
 * @param value - candidate session id.
 * @returns whether the value looks like a Session id.
 */
export function isSessionId(value) {
	return typeof value === 'string' && SESSION_ID.test(value);
}

/**
 * Coerce whatever the Host returned into a usable layout.
 * @param raw - parsed JSON.
 * @returns a normalized layout.
 */
export function normalizeLayout(raw) {
	const source = raw !== null && typeof raw === 'object' ? raw : {};
	const folders = [];
	for (const name of Array.isArray(source.folders) ? source.folders : []) {
		if (typeof name !== 'string' || name === '' || folders.includes(name)) continue;
		folders.push(name);
	}
	const order = [];
	for (const key of Array.isArray(source.order) ? source.order : []) {
		const parsed = parseKey(key);
		if (parsed === null || order.includes(key)) continue;
		if (parsed.kind === 'custom' && !folders.includes(parsed.value)) continue;
		order.push(key);
	}
	for (const name of folders) {
		if (!order.includes(customKey(name))) order.push(customKey(name));
	}
	const placement = {};
	const rawPlacement = source.placement !== null && typeof source.placement === 'object' ? source.placement : {};
	for (const [id, key] of Object.entries(rawPlacement)) {
		if (!isSessionId(id)) continue;
		const parsed = parseKey(key);
		if (parsed === null) continue;
		if (parsed.kind === 'custom' && !folders.includes(parsed.value)) continue;
		placement[id] = key;
	}
	const pinned = [];
	for (const entry of Array.isArray(source.pinned) ? source.pinned : []) {
		const valid = isSessionId(entry) || parseKey(entry) !== null;
		if (!valid || pinned.includes(entry)) continue;
		pinned.push(entry);
	}
	const sessions = {};
	const rawSessions = source.sessions !== null && typeof source.sessions === 'object' ? source.sessions : {};
	for (const [key, ids] of Object.entries(rawSessions)) {
		const parsed = parseKey(key);
		if (parsed === null) continue;
		if (parsed.kind === 'custom' && !folders.includes(parsed.value)) continue;
		const list = [];
		for (const id of Array.isArray(ids) ? ids : []) {
			if (!isSessionId(id) || list.includes(id)) continue;
			list.push(id);
		}
		if (list.length > 0) sessions[key] = list;
	}
	return { version: 1, order, folders, placement, pinned, sessions };
}

/**
 * Move one entry before another inside an ordered key list.
 * @param list - ordered keys.
 * @param moved - key being dragged.
 * @param before - anchor key, or undefined to append.
 * @returns a new list, or the same list when nothing changes.
 */
export function reorder(list, moved, before) {
	const from = list.indexOf(moved);
	if (from < 0) return list;
	const rest = list.filter((key) => key !== moved);
	if (before === undefined || before === moved) return rest.length === list.length ? rest : [...rest, moved];
	const into = rest.indexOf(before);
	if (into < 0) return list;
	return [...rest.slice(0, into), moved, ...rest.slice(into)];
}

/**
 * The Workspace ids in `order`, in display order.
 * @param layout - current layout.
 * @returns Workspace ids.
 */
export function workspaceOrder(layout) {
	const ids = [];
	for (const key of layout.order) {
		const parsed = parseKey(key);
		if (parsed !== null && parsed.kind === 'workspace' && !ids.includes(parsed.value)) ids.push(parsed.value);
	}
	return ids;
}

/**
 * Place one Session somewhere, or drop the override with `null`.
 * @param layout - current layout.
 * @param id - session id.
 * @param key - folder key, or null to return to the default position.
 * @returns a new layout.
 */
export function withPlacement(layout, id, key) {
	const placement = { ...layout.placement };
	if (key === null) delete placement[id];
	else placement[id] = key;
	return { ...layout, placement };
}

/**
 * Create a custom folder at the end of the order.
 * @param layout - current layout.
 * @param name - plain folder name.
 * @returns a new layout.
 */
export function addFolder(layout, name) {
	if (name === '' || layout.folders.includes(name)) return layout;
	return {
		...layout,
		folders: [...layout.folders, name],
		order: [...layout.order, customKey(name)],
	};
}

/**
 * Rename a custom folder, key, placement and pinned entries included.
 * @param layout - current layout.
 * @param from - current name.
 * @param to - next name.
 * @returns a new layout, or the same layout when the rename is invalid.
 */
export function renameFolder(layout, from, to) {
	if (from === to || to === '' || layout.folders.includes(to) || !layout.folders.includes(from)) return layout;
	const swap = (key) => (key === customKey(from) ? customKey(to) : key);
	const placement = {};
	for (const [id, key] of Object.entries(layout.placement)) placement[id] = swap(key);
	const sessions = {};
	for (const [key, ids] of Object.entries(layout.sessions)) sessions[swap(key)] = ids;
	return {
		...layout,
		folders: layout.folders.map((name) => (name === from ? to : name)),
		order: layout.order.map(swap),
		placement,
		pinned: layout.pinned.map(swap),
		sessions,
	};
}

/**
 * Remove a custom folder; its Sessions fall back to their default position.
 * @param layout - current layout.
 * @param name - folder name.
 * @returns a new layout.
 */
export function removeFolder(layout, name) {
	if (!layout.folders.includes(name)) return layout;
	const key = customKey(name);
	const placement = {};
	for (const [id, value] of Object.entries(layout.placement)) if (value !== key) placement[id] = value;
	const sessions = { ...layout.sessions };
	delete sessions[key];
	return {
		...layout,
		folders: layout.folders.filter((value) => value !== name),
		order: layout.order.filter((value) => value !== key),
		placement,
		pinned: layout.pinned.filter((value) => value !== key),
		sessions,
	};
}

/**
 * Pin a Session or a folder at the top of the list.
 * @param layout - current layout.
 * @param key - session id or folder key.
 * @returns a new layout.
 */
export function pinItem(layout, key) {
	if (layout.pinned.includes(key)) return layout;
	return { ...layout, pinned: [key, ...layout.pinned] };
}

/**
 * @param layout - current layout.
 * @param key - session id or folder key.
 * @returns a new layout.
 */
export function unpinItem(layout, key) {
	if (!layout.pinned.includes(key)) return layout;
	return { ...layout, pinned: layout.pinned.filter((value) => value !== key) };
}

/**
 * Drop one Session into a folder, or before one of its rows.
 *
 * The recorded order seeds from the rows the caller currently shows, so the
 * first drag into a folder keeps every Session that was already there.
 * @param layout - current layout.
 * @param id - dragged Session.
 * @param key - target folder key, `''` for 未归档.
 * @param before - anchor Session id, or undefined to append.
 * @param fallback - the Session's own folder key.
 * @param order - Session ids as currently rendered in that folder.
 * @returns a new layout.
 */
export function placeSession(layout, id, key, before, fallback, order) {
	const sessions = {};
	for (const [folder, ids] of Object.entries(layout.sessions)) sessions[folder] = ids.filter((value) => value !== id);
	const seed = Array.isArray(order) ? order : sessions[key] ?? [];
	const list = seed.filter((value) => value !== id);
	const into = before === undefined ? list.length : list.indexOf(before);
	const next = into < 0 ? [...list, id] : [...list.slice(0, into), id, ...list.slice(into)];
	sessions[key] = next;
	const placement = { ...layout.placement };
	if (key === '' || key === fallback) delete placement[id];
	else placement[id] = key;
	return { ...layout, placement, sessions };
}

/**
 * Reorder the pinned list.
 * @param layout - current layout.
 * @param moved - pinned key being dragged.
 * @param before - anchor pinned key, or undefined to append.
 * @returns a new layout.
 */
export function reorderPinned(layout, moved, before) {
	if (!layout.pinned.includes(moved)) return layout;
	return { ...layout, pinned: reorder(layout.pinned, moved, before) };
}

/**
 * Reorder the folder list.
 * @param layout - current layout.
 * @param moved - folder key being dragged.
 * @param before - anchor folder key, or undefined to append.
 * @returns a new layout.
 */
export function reorderFolders(layout, moved, before) {
	if (!layout.order.includes(moved)) return layout;
	return { ...layout, order: reorder(layout.order, moved, before) };
}
