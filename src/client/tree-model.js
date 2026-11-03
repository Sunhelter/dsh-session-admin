/**
 * Build the card list both seats share: the pinned Sessions in stored order,
 * then every other Session newest first, cut into the day-range buckets the
 * shipped chat list uses (今天 / 昨天 / 近 7 天 / 近 30 天 / 更早).
 *
 * Everything here is display-only. The card list never changes a Session's
 * native Workspace membership.
 */
/** Bucket ids in display order; each maps to a `bucket.<id>` locale entry. */
const BUCKETS = ['today', 'yesterday', 'week', 'month', 'older'];

/** One day in milliseconds. */
const DAY = 24 * 60 * 60 * 1000;

/**
 * Catalog rows worth drawing, newest first.
 * @param options - `{ catalog, archivedIds, goneIds, showArchived }`.
 * @returns the rows, the archived and gone Sets, and the current Session id.
 */
export function selectRows(options) {
	const { catalog, archivedIds, goneIds, showArchived } = options;
	const archived = new Set(archivedIds);
	const gone = new Set(goneIds);
	// The Session the main view retains is the current one; its card keeps a
	// permanent highlight so it can be found again after switching away.
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
		// A blank Session has no turns yet; the shipped sidebar keeps it out of the
		// history list until the first message gives it a title.
		if (row.blank === true) continue;
		if (gone.has(id)) continue;
		if (archived.has(id) && showArchived !== true) continue;
		rows.push(row);
	}
	rows.sort((left, right) => right.updatedAt - left.updatedAt);
	return { rows, archived, gone, currentId };
}

/**
 * @param ms - timestamp in milliseconds.
 * @returns the local midnight before it.
 */
function startOfDay(ms) {
	const date = new Date(ms);
	date.setHours(0, 0, 0, 0);
	return date.getTime();
}

/**
 * Which day-range bucket a Session belongs to.
 * @param updatedAt - Session timestamp in milliseconds.
 * @param now - reference time in milliseconds.
 * @returns the bucket id.
 */
export function bucketOf(updatedAt, now) {
	const today = startOfDay(now);
	const at = typeof updatedAt === 'number' ? updatedAt : 0;
	if (at >= today) return 'today';
	if (at >= today - DAY) return 'yesterday';
	if (at >= today - 7 * DAY) return 'week';
	if (at >= today - 30 * DAY) return 'month';
	return 'older';
}

/**
 * Draw the card list.
 * @param options - `{ rows, pinnedIds, needle, matches, now, t }`.
 * @returns `{ pinned, groups, visibleRows, selectable }`.
 */
export function buildCardList(options) {
	const { rows, pinnedIds, needle, matches, now, t } = options;
	const visible = needle === '' ? rows : rows.filter(matches);
	const pins = Array.isArray(pinnedIds) ? pinnedIds : [];
	const pinnedSet = new Set(pins);
	const pinned = [];
	const rest = [];
	for (const row of visible) {
		if (pinnedSet.has(row.id)) pinned.push(row);
		else rest.push(row);
	}
	const rank = new Map(pins.map((id, index) => [id, index]));
	pinned.sort((left, right) => (rank.get(left.id) ?? 0) - (rank.get(right.id) ?? 0));
	rest.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));

	const groups = [];
	let current = null;
	for (const row of rest) {
		const key = bucketOf(row.updatedAt, now);
		if (current === null || current.key !== key) {
			current = { key, label: t(`bucket.${key}`), rows: [] };
			groups.push(current);
		}
		current.rows.push(row);
	}
	// Keep the declared order even when a bucket has no row.
	groups.sort((left, right) => BUCKETS.indexOf(left.key) - BUCKETS.indexOf(right.key));

	const visibleRows = [...pinned, ...rest];
	return {
		pinned,
		groups,
		visibleRows,
		selectable: visibleRows.filter((row) => !row.running),
	};
}
