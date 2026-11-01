/**
 * Build the drawing model both seats share: the folders in layout order, the
 * pinned entries resolved to rows or groups, and the rows each folder owns.
 *
 * Everything here is display-only. The layout file decides where a Session is
 * drawn; the native Workspace snapshot only supplies labels and the fallback
 * folder for Sessions the layout never touched.
 */
import { parseKey } from './layout.js';

/**
 * Catalog rows worth drawing, newest first.
 * @param options - `{ catalog, archivedIds, goneIds, showArchived }`.
 * @returns the rows, the archived and gone Sets, and the current Session id.
 */
export function selectRows(options) {
	const { catalog, archivedIds, goneIds, showArchived } = options;
	const archived = new Set(archivedIds);
	const gone = new Set(goneIds);
	let currentId;
	for (const id of catalog.ids) {
		const row = catalog.byId[id];
		if (row !== undefined && (row.retainedBy?.mainView ?? 0) > 0) {
			currentId = id;
			break;
		}
	}
	const rows = [];
	for (const id of catalog.ids) {
		const row = catalog.byId[id];
		if (row === undefined) continue;
		if (gone.has(id)) continue;
		if (archived.has(id) && showArchived !== true) continue;
		rows.push(row);
	}
	rows.sort((left, right) => right.updatedAt - left.updatedAt);
	return { rows, archived, gone, currentId };
}

/**
 * One folder's Session list in the recorded order, keeping untouched rows in place.
 * @param order - recorded Session ids for this folder.
 * @param members - rows currently assigned to it, newest first.
 * @returns the reordered rows.
 */
function applyOrder(order, members) {
	if (!Array.isArray(order) || order.length === 0) return members;
	const remaining = new Map(members.map((row) => [row.id, row]));
	const list = [];
	for (const id of order) {
		const row = remaining.get(id);
		if (row === undefined) continue;
		remaining.delete(id);
		list.push(row);
	}
	for (const row of members) if (remaining.delete(row.id)) list.push(row);
	return list;
}

/**
 * Draw the tree.
 * @param options - `{ rows, base, workspaceInfo, defaultKey, needle, t, matches }`.
 * @returns `{ groups, groupByKey, rowById, pinned, pinnedKeys, rest, visibleRows, selectable }`.
 */
export function buildTreeModel(options) {
	const { rows, base, workspaceInfo, defaultKey, needle, t, matches } = options;
	const orderBy = options.orderBy === 'updated' ? 'updated' : 'manual';
	const pinnedIds = new Set(base.pinned);
	const byUpdated = (list) => [...list].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
	const orderSessions = (order, members) =>
		orderBy === 'updated' ? byUpdated(members) : applyOrder(order, members);
	const visible = needle === '' ? rows : rows.filter(matches);
	const currentId = rows.find((row) => (row.retainedBy?.mainView ?? 0) > 0)?.id;
	/**
	 * A folder with real Sessions hides its blank placeholders; an empty folder
	 * (e.g. a freshly added Workspace) keeps one so the folder still reads.
	 * The Session that is open right now is always kept.
	 */
	const dropBlanks = (members) => {
		if (!members.some((row) => row.blank !== true)) return members;
		return members.filter((row) => row.blank !== true || row.id === currentId);
	};

	const byKey = new Map();
	for (const key of base.order) {
		const parsed = parseKey(key);
		if (parsed === null) continue;
		if (parsed.kind === 'workspace') {
			const info = workspaceInfo.get(parsed.value);
			if (info === undefined) continue;
			byKey.set(key, { key, kind: 'workspace', label: info.label, sessions: [] });
		} else {
			byKey.set(key, { key, kind: 'custom', label: parsed.value, sessions: [] });
		}
	}
	const empty = [];
	for (const row of visible) {
		if (pinnedIds.has(row.id)) continue;
		const target = base.placement[row.id];
		const fallback = defaultKey(row.id);
		const key = target !== undefined && byKey.has(target) ? target : byKey.has(fallback) ? fallback : '';
		if (key === '') {
			empty.push(row);
			continue;
		}
		byKey.get(key).sessions.push(row);
	}

	let groups = [...byKey.values()].map((group) => ({
		...group,
		sessions: dropBlanks(orderSessions(base.sessions[group.key], group.sessions)),
	}));
	if (empty.length > 0) {
		groups.push({
			key: '',
			kind: 'ungrouped',
			label: t('groupUngrouped'),
			sessions: dropBlanks(orderSessions(undefined, empty)),
		});
	}
	if (needle !== '') groups = groups.filter((group) => group.sessions.length > 0);

	const groupByKey = new Map(groups.map((group) => [group.key, group]));
	const rowById = new Map(rows.map((row) => [row.id, row]));

	const pinned = [];
	for (const entry of base.pinned) {
		const parsed = parseKey(entry);
		if (parsed === null) {
			const row = rowById.get(entry);
			if (row !== undefined && (needle === '' || matches(row))) pinned.push({ kind: 'session', id: entry, row });
			continue;
		}
		const group = groupByKey.get(entry);
		if (group !== undefined) pinned.push({ kind: 'folder', key: entry, group });
	}
	const pinnedKeys = new Set(pinned.filter((entry) => entry.kind === 'folder').map((entry) => entry.key));
	const rest = groups.filter((group) => !pinnedKeys.has(group.key));

	const visibleRows = pinned.filter((entry) => entry.kind === 'session').map((entry) => entry.row);
	const seen = new Set(visibleRows.map((row) => row.id));
	for (const group of groups) {
		for (const row of group.sessions) {
			if (seen.has(row.id)) continue;
			seen.add(row.id);
			visibleRows.push(row);
		}
	}
	const selectable = visibleRows.filter((row) => !row.running);

	return { groups, groupByKey, rowById, pinned, pinnedKeys, rest, visibleRows, selectable };
}
