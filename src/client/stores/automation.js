/**
 * Sessions that currently hold an active Automation task, plus the last time a
 * scheduled reminder reached each Session.
 *
 * The Host schedule catalog is the one source of truth: an active record names
 * the Session it will wake, so the sidebar can show a clock where the shipped
 * shell would show a status dot. The catalog also keeps each task's last
 * acknowledged delivery, which the card list folds into the Session's sort time
 * — the shipped catalog stamps `updatedAt` from user-sourced prompts only, so a
 * Session woken by a reminder would otherwise keep the timestamp of its last
 * human message and sink under every newer Session. The remote face is optional
 * — a browser that never loads the schedule client simply never runs the
 * binder, and both values stay empty.
 */
import { createStore } from './create-store.js';

const EMPTY_IDS = new Set();
const EMPTY_AT = new Map();
const sessions = createStore(EMPTY_IDS);
const activity = createStore(EMPTY_AT);
let bound = false;

/**
 * Same membership in another Set? Keeps every catalog poll from waking React.
 * @param left - current ids.
 * @param right - incoming ids.
 * @returns true when both hold the same ids.
 */
function sameIds(left, right) {
	if (left.size !== right.size) return false;
	for (const id of left) if (!right.has(id)) return false;
	return true;
}

/**
 * Same entries in another Map? Same reason as {@link sameIds}.
 * @param left - current deliveries.
 * @param right - incoming deliveries.
 * @returns true when both hold the same keys and values.
 */
function sameTimes(left, right) {
	if (left.size !== right.size) return false;
	for (const [id, at] of left) if (right.get(id) !== at) return false;
	return true;
}

/**
 * Follow the schedule catalog and republish the scheduled Session ids and their
 * latest reminder deliveries. Must run inside the plugin fiber so the remote
 * face's lifetime is tied to it.
 * @param ctx - client context carrying the remote services.
 */
export function bindAutomation(ctx) {
	if (bound) return;
	bound = true;
	ctx.inject(['remote', 'remote.schedule'], (sctx) => {
		/**
		 * Pull the whole catalog; any failure keeps the last good sets. A Remote
		 * method answers with the `{ ok, value }` envelope, not the raw array.
		 */
		const load = async () => {
			try {
				const result = await sctx.remote.schedule.catalog();
				if (result === null || typeof result !== 'object' || result.ok !== true || !Array.isArray(result.value)) return;
				const ids = new Set();
				const at = new Map();
				for (const record of result.value) {
					if (
						record === null ||
						typeof record !== 'object' ||
						typeof record.sessionId !== 'string'
					) {
						continue;
					}
					if (record.status === 'active') ids.add(record.sessionId);
					// A one-shot task turns inactive after its delivery, but that delivery
					// is still the Session's latest activity; read every record.
					const deliveredAt = record.lastDelivery?.deliveredAt;
					if (typeof deliveredAt !== 'string') continue;
					const delivered = Date.parse(deliveredAt);
					if (!Number.isFinite(delivered)) continue;
					const previous = at.get(record.sessionId);
					if (previous === undefined || delivered > previous) at.set(record.sessionId, delivered);
				}
				if (!sameIds(ids, sessions.get())) sessions.set(ids);
				if (!sameTimes(at, activity.get())) activity.set(at);
			} catch {
				/* the catalog read needs a live connection; the next event retries */
			}
		};
		sctx.effect(() => {
			let offChanged = () => {};
			try {
				offChanged = sctx.remote.$on('schedule/changed', () => void load());
			} catch {
				/* a worker without event forwarding still gets the initial read */
			}
			const offReset = sctx.on('connection/reset', () => void load());
			void load();
			return () => {
				offChanged();
				offReset();
				if (sessions.get().size > 0) sessions.set(EMPTY_IDS);
				if (activity.get().size > 0) activity.set(EMPTY_AT);
			};
		}, 'session-admin: automation marks');
	});
}

/** @returns the ids of Sessions with at least one active task. */
export function useAutomationSessionIds() {
	return sessions.useValue();
}

/**
 * @returns Session id to the epoch milliseconds of its latest acknowledged
 *   reminder delivery, for every Session that has ever been woken by one.
 */
export function useAutomationActivity() {
	return activity.useValue();
}
