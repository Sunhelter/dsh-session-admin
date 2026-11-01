/**
 * Format one epoch-millisecond value for a row.
 * @param value - timestamp in milliseconds.
 * @returns a short local date-time.
 */
export function formatTime(value) {
	if (!Number.isFinite(value)) return '';
	const date = new Date(value);
	const pad = (part) => String(part).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Keep first occurrences in order.
 * @param values - values with possible duplicates.
 * @returns deduplicated values.
 */
export function orderedUnique(values) {
	const seen = new Set();
	const result = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	return result;
}
