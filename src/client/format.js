import { relativeTime } from '@deepseek-ai/dsh-client-ui-primitives';

/**
 * Compact relative time for a row's trailing cell, matching the shipped tree
 * ("刚刚" / "5分钟" / "2小时").
 * @param updatedAt - session timestamp in milliseconds.
 * @param now - reference time in milliseconds.
 * @param t - locale bind.
 * @returns the localized label.
 */
export function relativeLabel(updatedAt, now, t) {
	const { unit, n } = relativeTime(updatedAt, now);
	if (unit === 'now') return t('time.now');
	return t(`time.${unit}`, { n });
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
