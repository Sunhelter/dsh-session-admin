/**
 * One row of a Session's "…" menu: the destructive action plus the shared
 * confirmation overlay. Mounted by `sidebar.workspaces.session.menu.item`.
 */
import { h } from '../react.js';
import { setOverlay } from '../stores/overlay.js';

/** 16×16 outline trash glyph matching the shipped menu icon weight. */
const TRASH_ICON = h(
	'svg',
	{
		viewBox: '0 0 16 16',
		width: 14,
		height: 14,
		fill: 'none',
		xmlns: 'http://www.w3.org/2000/svg',
		'aria-hidden': 'true',
		strokeWidth: 1,
	},
	h('path', { d: 'M2.75 4.25h10.5', stroke: 'currentColor', strokeLinecap: 'round' }),
	h('path', {
		d: 'M6.25 4.25V3.3c0-.44.36-.8.8-.8h1.9c.44 0 .8.36.8.8v.95',
		stroke: 'currentColor',
		strokeLinecap: 'round',
	}),
	h('path', {
		d: 'M4.1 4.25l.55 8.3c.03.55.49.97 1.04.97h4.62c.55 0 1.01-.42 1.04-.97l.55-8.3',
		stroke: 'currentColor',
		strokeLinejoin: 'round',
	}),
	h('path', { d: 'M6.75 7v4.2M9.25 7v4.2', stroke: 'currentColor', strokeLinecap: 'round' }),
);

/**
 * @param props - row identity, menu open state, session catalog, locale seat.
 * @returns the menu row.
 */
export function SessionDeleteMenuItem(props) {
	const t = props.t;
	const [, setMenuOpen] = props.useMenuOpenState();
	const running = props.useSessions((state) => state.byId[props.sessionId]?.running === true);
	const title = props.displayTitle === '' ? t('unnamed') : props.displayTitle;
	return h(
		'div',
		{ className: 'sa-itemWrap' },
		h(
			'button',
			{
				type: 'button',
				role: 'menuitem',
				className: 'sa-item sa-item-danger',
				disabled: running,
				title: running ? t('runningHint') : undefined,
				onClick: () => {
					setMenuOpen(false);
					setOverlay({ kind: 'confirm', sessionId: props.sessionId, title });
				},
			},
			h('span', { className: 'sa-itemIcon' }, TRASH_ICON),
			h('span', { className: 'sa-itemLabel' }, t('deleteSession')),
		),
	);
}
