/**
 * Minimal external store: one value, a listener set, and the subscribe face
 * React's `useSyncExternalStore` expects. The plugin keeps its cross-seat state
 * (deleted rows, the frame overlay, the sidebar preference) in these instead of
 * React context, because each seat is mounted by the Host on its own.
 */
import React from '../react.js';

/**
 * Create one store.
 * @param initial - value before anything is written.
 * @returns the value API plus a subscription hook.
 */
export function createStore(initial) {
	let value = initial;
	const listeners = new Set();
	const subscribe = (listener) => {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	};
	return {
		/** @returns the current value. */
		get: () => value,
		/**
		 * Replace the value and wake every listener; an identical value is a no-op.
		 * @param next - the new value.
		 */
		set(next) {
			if (next === value) return;
			value = next;
			for (const listener of listeners) listener();
		},
		subscribe,
		/** @returns the current value, re-rendering the caller on every change. */
		useValue() {
			return React.useSyncExternalStore(subscribe, () => value, () => initial);
		},
	};
}
