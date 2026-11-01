/**
 * The Session tree: Workspace groups of Session rows, drawn to the same metrics
 * as the shipped sidebar tree (34px group rows, 32px session rows, hover-only
 * row actions, compact relative time). Pure presentation — data and actions all
 * arrive as props, so the settings page and the sidebar share one component.
 * `variant` only changes density and which affordances show.
 */
import React, { h } from '../react.js';
import {
	IconEditOutlineRegular,
	IconEllipsisOutlineRegular,
	IconFolderCloseRegular,
	IconFolderOpenRegular,
	IconNewChatOutlineRegular,
	IconTrashOutlineRegular,
	IconTriangleRightFillRegular,
	Menu,
	Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { relativeLabel } from '../format.js';

/**
 * A Session row's status dot (the shipped tree's running marker).
 * @param row - a catalog summary.
 * @param t - locale bind.
 * @returns the dot element or null.
 */
function statusDot(row, t) {
	if (row.running !== true) return null;
	return h('span', { className: 'sa-dot', title: t('running'), 'aria-label': t('running') });
}

/**
 * One Session's row menu.
 * @param props - `{ row, t, open, onOpenChange, onDelete }`.
 * @returns the anchor and its menu.
 */
function SessionMenu(props) {
	const { row, t, open, onOpenChange, onDelete } = props;
	const title = row.title !== undefined && row.title.trim() !== '' ? row.title : t('unnamed');
	return h(
		Menu,
		{
			open,
			onClose: () => onOpenChange(false),
			portal: true,
			closeOnPointerLeave: true,
			items: [
				{
					id: 'delete',
					label: t('deleteSession'),
					icon: h(IconTrashOutlineRegular, null),
					danger: true,
				},
			],
			onSelect: (id) => {
				onOpenChange(false);
				if (id === 'delete') onDelete(row);
			},
			anchor: h(
				'button',
				{
					className: 'sa-icon-btn',
					type: 'button',
					'aria-label': t('sessionActions', { title }),
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
 * One Session row.
 * @param props - `{ variant, row, now, selected, busy, t, onOpen, onSelect, onDelete }`.
 * @returns the row element.
 */
function SessionRow(props) {
	const { variant, row, now, selected, busy, t, onOpen, onSelect, onDelete } = props;
	const title = row.title !== undefined && row.title.trim() !== '' ? row.title : t('unnamed');
	const [menuOpen, setMenuOpen] = React.useState(false);

	if (variant === 'sidebar') {
		return h(
			'button',
			{
				className: 'sa-session sa-session-sidebar',
				type: 'button',
				title,
				disabled: busy,
				onClick: () => onOpen(row.id),
			},
			h('span', { className: 'sa-title' }, title),
			statusDot(row, t),
			h('span', { className: 'sa-time' }, relativeLabel(row.updatedAt, now, t)),
		);
	}

	const className = ['sa-session', selected ? 'sa-selected' : '', menuOpen ? 'sa-menu-open' : '']
		.filter((part) => part !== '')
		.join(' ');

	return h(
		'div',
		{ className, role: 'treeitem', 'aria-selected': selected },
		h('input', {
			className: 'sa-check',
			type: 'checkbox',
			checked: selected,
			disabled: row.running || busy,
			title: row.running ? t('runningHint') : title,
			'aria-label': title,
			onClick: (event) => event.stopPropagation(),
			onChange: () => onSelect(row.id),
		}),
		h(
			'button',
			{ className: 'sa-open', type: 'button', disabled: busy, title, onClick: () => onOpen(row.id) },
			h('span', { className: 'sa-title' }, title),
			statusDot(row, t),
		),
		h('span', { className: 'sa-time' }, relativeLabel(row.updatedAt, now, t)),
		h(
			'span',
			{ className: 'sa-row-actions' },
			h(SessionMenu, {
				row,
				t,
				open: menuOpen,
				onOpenChange: setMenuOpen,
				onDelete: (target) => {
					if (typeof onDelete === 'function') onDelete(target);
				},
			}),
		),
	);
}

/**
 * One Workspace group: header row plus its Session rows.
 * @param props - `{ group, now, expanded, selection, busy, variant, t,
 *   onToggle, onOpen, onSelect, onDelete, onNewSession, onRenameWorkspace,
 *   onDeleteWorkspace }`.
 * @returns the group element.
 */
function Group(props) {
	const { group, now, expanded, selection, busy, variant, t } = props;
	const [menuOpen, setMenuOpen] = React.useState(false);
	const sessions = Array.isArray(group.sessions) ? group.sessions : [];
	const toggle = () => {
		if (typeof props.onToggle === 'function') props.onToggle(group.key);
	};

	const menu = () =>
		h(
			Menu,
			{
				open: menuOpen,
				onClose: () => setMenuOpen(false),
				portal: true,
				closeOnPointerLeave: true,
				items: [
					{ id: 'rename', label: t('renameWorkspace'), icon: h(IconEditOutlineRegular, null) },
					{ id: 'delete', label: t('deleteWorkspace'), icon: h(IconTrashOutlineRegular, null), danger: true },
				],
				onSelect: (id) => {
					setMenuOpen(false);
					if (id === 'rename' && typeof props.onRenameWorkspace === 'function') props.onRenameWorkspace(group);
					if (id === 'delete' && typeof props.onDeleteWorkspace === 'function') props.onDeleteWorkspace(group);
				},
				anchor: h(
					'button',
					{
						className: 'sa-icon-btn',
						type: 'button',
						'aria-label': t('workspaceActions', { name: group.label }),
						onClick: (event) => {
							event.stopPropagation();
							setMenuOpen((open) => !open);
						},
					},
					h(IconEllipsisOutlineRegular, null),
				),
			},
		);

	const head = h(
		'div',
		{
			className: ['sa-group', menuOpen ? 'sa-menu-open' : ''].filter((part) => part !== '').join(' '),
			role: 'treeitem',
			'aria-expanded': expanded,
			onClick: toggle,
		},
		h(
			'span',
			{ className: 'sa-slot sa-folder' },
			expanded ? h(IconFolderOpenRegular, null) : h(IconFolderCloseRegular, null),
		),
		h(
			'span',
			{ className: 'sa-slot sa-chevron' },
			h(IconTriangleRightFillRegular, { className: expanded ? 'sa-arrow sa-arrow-open' : 'sa-arrow' }),
		),
		h('span', { className: 'sa-title' }, group.label),
		group.key === ''
			? null
			: h(
					'span',
					{ className: 'sa-row-actions' },
					menu(),
					h(
						Tooltip,
						{ label: t('newSession'), side: 'bottom', align: 'end', delayMs: 500, portal: true },
						h(
							'button',
							{
								className: 'sa-icon-btn',
								type: 'button',
								'aria-label': t('newSessionIn', { name: group.label }),
								onClick: (event) => {
									event.stopPropagation();
									if (typeof props.onNewSession === 'function') props.onNewSession(group);
								},
							},
							h(IconNewChatOutlineRegular, null),
						),
					),
				),
	);

	let body = null;
	if (expanded) {
		if (sessions.length === 0) body = h('div', { className: 'sa-empty-group' }, t('folderEmpty'));
		else
			body = h(
				'div',
				{ className: 'sa-rows' },
				sessions.map((row) =>
					h(SessionRow, {
						key: row.id,
						variant,
						row,
						now,
						selected: selection.includes(row.id),
						busy,
						t,
						onOpen: props.onOpen,
						onSelect: props.onSelect,
						onDelete: props.onDelete,
					}),
				),
			);
	}

	return h('div', { className: 'sa-block', key: group.key }, head, body);
}

/**
 * @param props - `{ variant, groups, expanded, selection, busy, onOpen,
 *   onToggle, onSelectionChange, t, onDelete, onNewSession,
 *   onRenameWorkspace, onDeleteWorkspace }`; see roadmap §3.1.
 * @returns the tree element.
 */
export function SessionTree(props) {
	const t = props.t;
	const variant = props.variant === 'sidebar' ? 'sidebar' : 'panel';
	const groups = Array.isArray(props.groups) ? props.groups : [];
	const expanded = Array.isArray(props.expanded) ? props.expanded : [];
	const selection = Array.isArray(props.selection) ? props.selection : [];
	const busy = props.busy === true;
	const now = Date.now();
	const open = (id) => {
		if (busy) return;
		if (typeof props.onOpen === 'function') props.onOpen(id);
	};
	const select = (id) => {
		if (busy) return;
		if (typeof props.onSelectionChange === 'function') props.onSelectionChange(id);
	};

	return h(
		'div',
		{ className: variant === 'sidebar' ? 'sa-tree sa-tree-sidebar' : 'sa-tree', role: 'tree' },
		groups.map((group) =>
			h(Group, {
				key: group.key,
				group,
				now,
				expanded: expanded.includes(group.key),
				selection,
				busy,
				variant,
				t,
				onToggle: props.onToggle,
				onOpen: open,
				onSelect: select,
				onDelete: props.onDelete,
				onNewSession: props.onNewSession,
				onRenameWorkspace: props.onRenameWorkspace,
				onDeleteWorkspace: props.onDeleteWorkspace,
			}),
		),
	);
}
