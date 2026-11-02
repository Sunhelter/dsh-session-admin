/**
 * Sessions that currently hold an active Automation task.
 *
 * The Host schedule catalog is the one source of truth: an active record names
 * the Session it will wake, so the sidebar can show a clock where the shipped
 * shell would show a status dot. The remote face is optional — a browser that
 * never loads the schedule client simply never runs the binder, and the set
 * stays empty.
 */
import { createStore } from './create-store.js';

const EMPTY = new Set();
const sessions = createStore(EMPTY);
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
 * Follow the schedule catalog and republish the set of scheduled Session ids.
 * Must run inside the plugin fiber so the remote face's lifetime is tied to it.
 * @param ctx - client context carrying the remote services.
 */
export function bindAutomation(ctx) {
	if (bound) return;
	bound = true;
	ctx.inject(['remote', 'remote.schedule'], (sctx) => {
		/**
		 * Pull the whole catalog; any failure keeps the last good set. A Remote
		 * method answers with the `{ ok, value }` envelope, not the raw array.
		 */
		const load = async () => {
			try {
				const result = await sctx.remote.schedule.catalog();
				if (result === null || typeof result !== 'object' || result.ok !== true || !Array.isArray(result.value)) return;
				const ids = new Set();
				for (const record of result.value) {
					if (
						record !== null &&
						typeof record === 'object' &&
						record.status === 'active' &&
						typeof record.sessionId === 'string'
					) {
						ids.add(record.sessionId);
					}
				}
				if (!sameIds(ids, sessions.get())) sessions.set(ids);
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
				if (sessions.get().size > 0) sessions.set(EMPTY);
			};
		}, 'session-admin: automation marks');
	});
}

/** @returns the ids of Sessions with at least one active task. */
export function useAutomationSessionIds() {
	return sessions.useValue();
}
