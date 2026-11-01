/**
 * The one settings row that swaps the native sidebar for this plugin's own.
 * Kept as its own component so later settings rows can sit beside it.
 */
import React, { h } from '../react.js';
import { setShellOverride, useShellOverride } from '../stores/shell.js';

/**
 * @param props - locale seat.
 * @returns the preference row with its switch.
 */
export function SidebarSwitch(props) {
	const t = props.t;
	const enabled = useShellOverride();
	return h(
		'div',
		{ className: 'sa-pref' },
		h(
			'div',
			{ className: 'sa-pref-text' },
			h('div', { className: 'sa-pref-label' }, t('shell')),
			h('div', { className: 'sa-pref-desc' }, t('shellDesc')),
		),
		h('button', {
			className: 'sa-switch',
			type: 'button',
			role: 'switch',
			'aria-checked': enabled,
			'aria-label': t('shell'),
			onClick: () => setShellOverride(!enabled),
		}),
	);
}
