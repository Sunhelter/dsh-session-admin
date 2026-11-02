/**
 * The Session card list: a pinned section first, then one card per Session cut
 * into day-range buckets. A card carries the shipped row's first line (status
 * mark, title, relative time, hover actions) and the Workspace name under it.
 *
 * Pure presentation — data and actions all arrive as props, so the settings
 * page and the sidebar share one component.
 */
import React, { h } from '../react.js';
import {
	IconArchiveOutlineRegular,
	IconClockOutlineRegular,
	IconEditOutlineRegular,
	IconEllipsisOutlineRegular,
	IconPinOutlineRegular,
	IconTrashOutlineRegular,
	IconUnarchiveOutlineRegular,
	Menu,
	Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { relativeLabel } from '../format.js';

/**
 * A card's status dot (the shipped tree's running marker).
 * @param row - a catalog summary.
 * @param t - locale bind.
 * @returns the dot element or null.
 */
function statusDot(row, t, unread) {
	if (row.running === true) {
		return h('span', { className: 'sa-dot', title: t('running'), 'aria-label': t('running') });
	}
	if (unread === true) {
		return h('span', { className: 'sa-dot sa-dot-done', title: t('completed'), 'aria-label': t('completed') });
	}
	return null;
}

/**
 * @param row - catalog summary.
 * @param t - locale bind.
 * @returns the row title.
 */
function rowTitle(row, t) {
	return row.title !== undefined && row.title.trim() !== '' ? row.title : t('unnamed');
}

/**
 * One Session's card menu: pin, rename, archive (or restore), delete.
 * @param props - `{ row, pinned, archived, t, open, onOpenChange, onDelete,
 *   onPin, onUnpin, onArchive, onUnarchive, onRename }`.
 * @returns the anchor and its menu.
 */
function SessionMenu(props) {
	const { row, pinned, archived, t, open, onOpenChange, onDelete, onPin, onUnpin } = props;
	const title = rowTitle(row, t);
	const items = [
		{ id: 'rename', label: t('renameSession'), icon: h(IconEditOutlineRegular, null) },
		{
			id: 'pin',
			label: pinned ? t('unpin') : t('pin'),
			icon: h(IconPinOutlineRegular, null),
		},
		archived
			? { id: 'archive', label: t('unarchive'), icon: h(IconUnarchiveOutlineRegular, null) }
			: { id: 'archive', label: t('archive'), icon: h(IconArchiveOutlineRegular, null) },
		{ id: 'delete', label: t('deleteSession'), icon: h(IconTrashOutlineRegular, null), danger: true },
	];
	return h(
		Menu,
		{
			open,
			onClose: () => onOpenChange(false),
			portal: true,
			closeOnPointerLeave: true,
			items,
			onSelect: (id) => {
				onOpenChange(false);
				if (id === 'rename' && typeof props.onRename === 'function') props.onRename(row);
				if (id === 'pin') {
					const handler = pinned ? onUnpin : onPin;
					if (typeof handler === 'function') handler(row.id);
				}
				if (id === 'archive') {
					const handler = archived ? props.onUnarchive : props.onArchive;
					if (typeof handler === 'function') handler(row.id);
				}
				if (id === 'delete' && typeof onDelete === 'function') onDelete(row);
			},
			anchor: h(
				'button',
				{
					className: 'sa-icon-btn',
					type: 'button',
					'aria-label': t('sessionActions', { title }),
					onPointerDown: (event) => event.stopPropagation(),
					onClick: (event) => {
						event.stopPropagation();
						onOpenChange(!open);
					},
				},
				h(IconEllipsisOutlineRegular, null),
			),
		},
	);
}

/**
 * One Session card.
 * @param props - `{ variant, row, workspaceLabel, now, pinned, archived, unread,
 *   automation, selected, busy, t, onOpen, onSelect, onDelete, onPin, onUnpin,
 *   onArchive, onUnarchive, onRename }`.
 * @returns the card element.
 */
function SessionCard(props) {
	const { variant, row, workspaceLabel, now, pinned, archived, unread, automation, selected, busy, t } = props;
	const selectMode = props.selectMode === true && variant === 'sidebar';
	const current = props.current === true;
	const title = rowTitle(row, t);
	const [menuOpen, setMenuOpen] = React.useState(false);
	const blocked = busy === true || archived === true;
	const toggle = () => {
		if (blocked) return;
		if (typeof props.onSelect === 'function') props.onSelect(row.id);
	};
	const open = () => {
		if (blocked) return;
		if (selectMode === true) {
			toggle();
			return;
		}
		if (typeof props.onOpen === 'function') props.onOpen(row.id);
	};

	const className = [
		'sa-card',
		variant === 'sidebar' ? 'sa-card-sidebar' : '',
		pinned === true ? 'sa-pinned-card' : '',
		archived === true ? 'sa-archived' : '',
		selected ? 'sa-selected' : '',
		current ? 'sa-current' : '',
		menuOpen ? 'sa-menu-open' : '',
	]
		.filter((part) => part !== '')
		.join(' ');

	const mark = () => {
		if (dot !== null) return h('span', { className: 'sa-slot' }, dot);
		if (pinned === true) {
			return h('span', { className: 'sa-slot sa-pin' }, h(IconPinOutlineRegular, null));
		}
		if (automation === true) {
			return h(
				'span',
				{ className: 'sa-slot sa-clock', title: t('automation'), 'aria-label': t('automation') },
				h(IconClockOutlineRegular, null),
			);
		}
		return h('span', { className: 'sa-slot', 'aria-hidden': true });
	};

	const togglePin = (event) => {
		event.stopPropagation();
		const handler = pinned === true ? props.onUnpin : props.onPin;
		if (typeof handler === 'function') handler(row.id);
	};

	const dot = statusDot(row, t, unread);
	return h(
		'div',
		{
			className,
			'data-session-id': row.id,
			role: 'button',
			tabIndex: blocked ? -1 : 0,
			'aria-disabled': blocked,
			title: archived === true ? t('archivedHint') : title,
			onClick: open,
			onKeyDown: (event) => {
				if (event.target !== event.currentTarget) return;
				if (event.key !== 'Enter' && event.key !== ' ') return;
				event.preventDefault();
				open();
			},
		},
		variant === 'sidebar'
			? selectMode === true
				? h('span', {
						className: selected === true ? 'sa-check-ring sa-check-ring-on' : 'sa-check-ring',
						role: 'checkbox',
						'aria-checked': selected === true,
						'aria-label': title,
						onClick: (event) => {
							event.stopPropagation();
							toggle();
						},
					})
				: mark()
			: h('input', {
					className: 'sa-check',
					type: 'checkbox',
					checked: selected === true,
					disabled: row.running === true || busy === true,
					title: row.running === true ? t('runningHint') : title,
					'aria-label': title,
					onClick: (event) => event.stopPropagation(),
					onChange: () => {
						if (typeof props.onSelect === 'function') props.onSelect(row.id);
					},
				}),
		h(
			'div',
			{ className: 'sa-card-body' },
			h(
				'div',
				{ className: 'sa-card-head' },
				variant === 'sidebar' ? null : mark(),
				h(
					'span',
					{ className: 'sa-card-title' },
					h('span', { className: 'sa-title' }, title),
					archived === true ? h('span', { className: 'sa-tag' }, t('archivedTag')) : null,
				),

				h(
					'span',
					{ className: 'sa-row-actions' },
					h(
						Tooltip,
						{
							label: pinned === true ? t('unpin') : t('pin'),
							side: 'bottom',
							align: 'end',
							delayMs: 500,
							portal: true,
						},
						h(
							'button',
							{
								className: 'sa-icon-btn',
								type: 'button',
								'aria-label': pinned === true ? t('unpin') : t('pin'),
								onPointerDown: (event) => event.stopPropagation(),
								onClick: togglePin,
							},
							h(IconPinOutlineRegular, null),
						),
					),
					h(SessionMenu, {
						row,
						pinned: pinned === true,
						archived: archived === true,
						t,
						open: menuOpen,
						onOpenChange: setMenuOpen,
						onDelete: (target) => {
							if (typeof props.onDelete === 'function') props.onDelete(target);
						},
						onPin: (id) => {
							if (typeof props.onPin === 'function') props.onPin(id);
						},
						onUnpin: (id) => {
							if (typeof props.onUnpin === 'function') props.onUnpin(id);
						},
						onArchive: props.onArchive,
						onUnarchive: props.onUnarchive,
						onRename: props.onRename,
					}),
				),
			),
			h(
				'div',
				{ className: 'sa-card-sub' },
				h('span', { className: 'sa-card-ws', title: workspaceLabel }, workspaceLabel),
				h('span', { className: 'sa-card-time' }, relativeLabel(row.updatedAt, now, t)),
			),
		),
	);
}

/**
 * One named block: the pinned section or one day-range bucket.
 * @param props - `{ label, showLabel, rows, ...card props }`.
 * @returns the section element.
 */
function CardSection(props) {
	return h(
		'div',
		{ className: 'sa-section' },
		props.showLabel === false ? null : h('div', { className: 'sa-section-label' }, props.label),
		props.rows.map((row) =>
			h(SessionCard, {
				key: row.id,
				variant: props.variant,
				row,
				now: props.now,
				workspaceLabel: props.workspaceLabels.get(row.id) ?? props.t('workspaceUnknown'),
				pinned: props.pinnedIds.has(row.id),
				archived: props.archived.has(row.id),
				unread: props.unread.has(row.id),
				automation: props.automation.has(row.id),
				selected: props.selection.includes(row.id),
				current: row.id === props.currentId,
				selectMode: props.selectMode === true,
				busy: props.busy,
				t: props.t,
				onOpen: props.onOpen,
				onSelect: props.onSelect,
				onDelete: props.onDelete,
				onPin: props.onPin,
				onUnpin: props.onUnpin,
				onArchive: props.onArchive,
				onUnarchive: props.onUnarchive,
				onRename: props.onRename,
			}),
		),
	);
}

/**
 * @param props - `{ variant, pinned, groups, workspaceLabels, selection, busy,
 *   archived, unread, automation, hideFirstLabel, t, onOpen, onSelectionChange,
 *   onDelete, onPin, onUnpin, onArchive, onUnarchive, onRename }`.
 * @returns the card list element.
 */
export function SessionTree(props) {
	const t = props.t;
	const variant = props.variant === 'sidebar' ? 'sidebar' : 'panel';
	const pinned = Array.isArray(props.pinned) ? props.pinned : [];
	const groups = Array.isArray(props.groups) ? props.groups : [];
	const selection = Array.isArray(props.selection) ? props.selection : [];
	const archived = props.archived instanceof Set ? props.archived : new Set();
	const unread = props.unread instanceof Set ? props.unread : new Set();
	const automation = props.automation instanceof Set ? props.automation : new Set();
	const workspaceLabels = props.workspaceLabels instanceof Map ? props.workspaceLabels : new Map();
	const currentId = props.currentId;
	const pinnedIds = new Set(pinned.map((row) => row.id));
	const now = Date.now();
	const open = (id) => {
		if (props.busy === true) return;
		if (typeof props.onOpen === 'function') props.onOpen(id);
	};
	const select = (id) => {
		if (props.busy === true) return;
		if (typeof props.onSelectionChange === 'function') props.onSelectionChange(id);
	};

	const shared = {
		variant,
		now,
		currentId,
		workspaceLabels,
		pinnedIds,
		archived,
		unread,
		automation,
		selection,
		selectMode: props.selectMode === true,
		busy: props.busy === true,
		t,
		onOpen: open,
		onSelect: select,
		onDelete: props.onDelete,
		onPin: props.onPin,
		onUnpin: props.onUnpin,
		onArchive: props.onArchive,
		onUnarchive: props.onUnarchive,
		onRename: props.onRename,
	};

	return h(
		'div',
		{ className: variant === 'sidebar' ? 'sa-tree sa-tree-sidebar' : 'sa-tree' },
		pinned.length === 0
			? null
			: h(CardSection, {
					...shared,
					label: t('pinnedSection'),
					showLabel: props.hideFirstLabel !== true,
					rows: pinned,
				}),
		groups.map((group, index) =>
			h(CardSection, {
				...shared,
				key: group.key,
				label: group.label,
				showLabel: !(props.hideFirstLabel === true && pinned.length === 0 && index === 0),
				rows: group.rows,
			}),
		),
	);
}
