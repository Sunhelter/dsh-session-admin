/**
 * The Session tree: pinned entries first, then a Workspace group (one per
 * folder in the stored layout) of Session rows. Drawn to the same metrics as
 * the shipped sidebar tree (34px group rows, 32px session rows, hover-only row
 * actions, compact relative time). Pure presentation — data and actions all
 * arrive as props, so the settings page and the sidebar share one component.
 *
 * Folders are display-only: dropping a Session into another folder changes
 * where it is shown, never its native Workspace membership.
 */
import React, { h } from '../react.js';
import {
	IconArchiveOutlineRegular,
	IconEditOutlineRegular,
	IconEllipsisOutlineRegular,
	IconFolderCloseRegular,
	IconFolderOpenRegular,
	IconNewChatOutlineRegular,
	IconPinOutlineRegular,
	IconTrashOutlineRegular,
	IconTriangleRightFillRegular,
	IconUnarchiveOutlineRegular,
	Menu,
	Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { parseKey } from '../layout.js';
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
 * @param row - catalog summary.
 * @param t - locale bind.
 * @returns the row title.
 */
function rowTitle(row, t) {
	return row.title !== undefined && row.title.trim() !== '' ? row.title : t('unnamed');
}

/**
 * One Session's row menu: pin, archive (or restore), delete.
 * @param props - `{ row, pinned, archived, t, open, onOpenChange, onDelete,
 *   onPin, onUnpin, onArchive, onUnarchive }`.
 * @returns the anchor and its menu.
 */
function SessionMenu(props) {
	const { row, pinned, archived, t, open, onOpenChange, onDelete, onPin, onUnpin } = props;
	const title = rowTitle(row, t);
	const items = [
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
				if (id === 'pin' && typeof onPin === 'function') onPin(row.id);
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
 * @param props - `{ variant, row, now, pinned, archived, selected, busy, t,
 *   onOpen, onSelect, onDelete, onPin, onUnpin, onArchive, onUnarchive,
 *   onDragStart }`.
 * @returns the row element.
 */
function SessionRow(props) {
	const { variant, row, now, pinned, archived, selected, busy, t, onOpen, onSelect, onDelete } = props;
	const title = rowTitle(row, t);
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
			pinned === true ? h('span', { className: 'sa-slot sa-pin' }, h(IconPinOutlineRegular, null)) : null,
			h('span', { className: 'sa-title' }, title),
			archived === true ? h('span', { className: 'sa-tag' }, t('archivedTag')) : null,
			statusDot(row, t),
			h('span', { className: 'sa-time' }, relativeLabel(row.updatedAt, now, t)),
		);
	}

	const className = [
		'sa-session',
		pinned === true ? 'sa-pinned-row' : '',
		archived === true ? 'sa-archived' : '',
		selected ? 'sa-selected' : '',
		menuOpen ? 'sa-menu-open' : '',
		props.dropBefore === true ? 'sa-drop-before' : '',
	]
		.filter((part) => part !== '')
		.join(' ');

	return h(
		'div',
		{
			className,
			role: 'treeitem',
			'aria-selected': selected,
			'data-session-id': row.id,
			draggable: busy !== true,
			onDragStart: (event) => {
				event.stopPropagation();
				if (typeof props.onDragStart === 'function') props.onDragStart(row);
			},
		},
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
			{
				className: 'sa-open',
				type: 'button',
				disabled: busy || archived === true,
				title: archived === true ? t('archivedHint') : title,
				onClick: () => onOpen(row.id),
			},
			h('span', { className: 'sa-title' }, title),
			archived === true ? h('span', { className: 'sa-tag' }, t('archivedTag')) : null,
			statusDot(row, t),
		),
		h('span', { className: 'sa-time' }, relativeLabel(row.updatedAt, now, t)),
		h(
			'span',
			{ className: 'sa-row-actions' },
			h(SessionMenu, {
				row,
				pinned: pinned === true,
				archived: archived === true,
				onArchive: props.onArchive,
				onUnarchive: props.onUnarchive,
				t,
				open: menuOpen,
				onOpenChange: setMenuOpen,
				onDelete: (target) => {
					if (typeof onDelete === 'function') onDelete(target);
				},
				onPin: (target) => {
					const handler = pinned === true ? props.onUnpin : props.onPin;
					if (typeof handler === 'function') handler(target);
				},
			}),
		),
	);
}

/**
 * One folder group: header row plus its Session rows.
 * @param props - `{ group, kind, pinned, now, expanded, selection, busy, variant,
 *   t, dropTarget, dragKind, onToggle, onOpen, onSelect, onDelete, onNewSession,
 *   onRenameWorkspace, onDeleteWorkspace, onRenameFolder, onDeleteFolder,
 *   onPin, onUnpin, onDragStart, onDragOver, onDrop }`.
 * @returns the group element.
 */
function Group(props) {
	const { group, kind, pinned, now, expanded, selection, busy, variant, t } = props;
	const [menuOpen, setMenuOpen] = React.useState(false);
	const sessions = Array.isArray(group.sessions) ? group.sessions : [];
	const ungrouped = kind === 'ungrouped';
	const toggle = () => {
		if (typeof props.onToggle === 'function') props.onToggle(group.key);
	};

	const menuItems = [];
	if (kind === 'workspace') {
		menuItems.push({ id: 'rename', label: t('renameWorkspace'), icon: h(IconEditOutlineRegular, null) });
		menuItems.push({ id: 'delete', label: t('deleteWorkspace'), icon: h(IconTrashOutlineRegular, null), danger: true });
	}
	if (kind === 'custom') {
		menuItems.push({ id: 'rename', label: t('renameFolder'), icon: h(IconEditOutlineRegular, null) });
		menuItems.push({ id: 'delete', label: t('deleteFolder'), icon: h(IconTrashOutlineRegular, null), danger: true });
	}
	menuItems.push({ id: 'pin', label: pinned === true ? t('unpin') : t('pin'), icon: h(IconPinOutlineRegular, null) });

	const menu = () =>
		h(
			Menu,
			{
				open: menuOpen,
				onClose: () => setMenuOpen(false),
				portal: true,
				closeOnPointerLeave: true,
				items: menuItems,
				onSelect: (id) => {
					setMenuOpen(false);
					if (id === 'rename') {
						if (kind === 'workspace' && typeof props.onRenameWorkspace === 'function') props.onRenameWorkspace(group);
						if (kind === 'custom' && typeof props.onRenameFolder === 'function') props.onRenameFolder(group);
					}
					if (id === 'delete') {
						if (kind === 'workspace' && typeof props.onDeleteWorkspace === 'function') props.onDeleteWorkspace(group);
						if (kind === 'custom' && typeof props.onDeleteFolder === 'function') props.onDeleteFolder(group);
					}
					if (id === 'pin') {
						const handler = pinned === true ? props.onUnpin : props.onPin;
						if (typeof handler === 'function') handler(group.key);
					}
				},
				anchor: h(
					'button',
					{
						className: 'sa-icon-btn',
						type: 'button',
						'aria-label': kind === 'custom' ? t('folderActions', { name: group.label }) : t('workspaceActions', { name: group.label }),
						onClick: (event) => {
							event.stopPropagation();
							setMenuOpen((open) => !open);
						},
					},
					h(IconEllipsisOutlineRegular, null),
				),
			},
		);

	const canDrop =
		props.dragKind === 'session' || props.dragKind === 'folder' || (pinned === true && props.dragKind === 'pinned');
	const className = [
		'sa-group',
		menuOpen ? 'sa-menu-open' : '',
		pinned === true ? 'sa-pinned-group' : '',
		props.dropTarget === group.key ? 'sa-drop-target' : '',
	]
		.filter((part) => part !== '')
		.join(' ');

	const head = h(
		'div',
		{
			className,
			role: 'treeitem',
			'aria-expanded': expanded,
			draggable: ungrouped !== true && busy !== true,
			onClick: toggle,
			onDragStart: (event) => {
				if (ungrouped === true) return;
				event.stopPropagation();
				if (typeof props.onDragStart === 'function') props.onDragStart(group);
			},
			onDragOver: (event) => {
				if (!canDrop) return;
				event.preventDefault();
				if (typeof props.onDragOver === 'function') props.onDragOver(group.key);
			},
			onDragLeave: (event) => {
				if (event.currentTarget.contains(event.relatedTarget)) return;
				if (typeof props.onDragOver === 'function') props.onDragOver(null);
			},
			onDrop: (event) => {
				if (ungrouped === true && props.dragKind !== 'session') return;
				event.preventDefault();
				if (typeof props.onDrop === 'function') props.onDrop(group);
			},
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
		ungrouped
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
				{
					className: 'sa-rows',
					onDragOver: (event) => {
						if (props.dragKind !== 'session') return;
						const element = event.target instanceof Element ? event.target.closest('[data-session-id]') : null;
						event.preventDefault();
						event.stopPropagation();
						const id = element === null ? null : element.getAttribute('data-session-id');
						if (typeof props.onDragOver === 'function') props.onDragOver(id === null ? group.key : `row:${id}`);
					},
					onDrop: (event) => {
						if (props.dragKind !== 'session') return;
						const element = event.target instanceof Element ? event.target.closest('[data-session-id]') : null;
						event.preventDefault();
						event.stopPropagation();
						const id = element === null ? undefined : element.getAttribute('data-session-id');
						if (typeof props.onDropRow === 'function') props.onDropRow(group, id);
					},
				},
				sessions.map((row) =>
					h(SessionRow, {
						key: row.id,
						variant,
						row,
						now,
						pinned: false,
						archived: props.archived instanceof Set && props.archived.has(row.id),
						selected: selection.includes(row.id),
						busy,
						t,
						dropBefore: props.dropTarget === `row:${row.id}`,
						onOpen: props.onOpen,
						onSelect: props.onSelect,
						onDelete: props.onDelete,
						onPin: props.onPin,
						onArchive: props.onArchive,
						onUnarchive: props.onUnarchive,
						onDragStart: props.onSessionDragStart,
					}),
				),
			);
	}

	return h('div', { className: 'sa-block' }, head, body);
}

/**
 * One pinned entry: a Session row, or a whole folder group hoisted up.
 * @param props - `{ entry, ...tree props }`.
 * @returns the pinned element.
 */
function PinnedEntry(props) {
	const { entry, t, dropTarget, dragKind } = props;
	if (entry.kind === 'folder') {
		return h(Group, {
			group: entry.group,
			kind: entry.group.kind,
			pinned: true,
			now: props.now,
			expanded: props.expanded.includes(entry.group.key),
			selection: props.selection,
			busy: props.busy,
			variant: props.variant,
			t,
			dropTarget,
			dragKind,
			onToggle: props.onToggle,
			onOpen: props.onOpen,
			onSelect: props.onSelect,
			onDelete: props.onDelete,
			onNewSession: props.onNewSession,
			onRenameWorkspace: props.onRenameWorkspace,
			onDeleteWorkspace: props.onDeleteWorkspace,
			onRenameFolder: props.onRenameFolder,
			onDeleteFolder: props.onDeleteFolder,
			onPin: props.onPin,
			onUnpin: props.onUnpin,
			archived: props.archived,
			onArchive: props.onArchive,
			onUnarchive: props.onUnarchive,
			onDragStart: (group) => props.onPinnedDragStart(group.key),
			onDragOver: props.onDragOver,
			onDrop: (group) => props.onPinnedDrop(group.key),
			onDropRow: (group, before) => props.onPinnedDropRow(group, before),
		});
	}
	const row = entry.row;
	return h(
		'div',
		{
			className: [
				'sa-pinned-entry',
				dropTarget === entry.row.id ? 'sa-drop-target' : '',
			]
				.filter((part) => part !== '')
				.join(' '),
			draggable: props.busy !== true,
			onDragStart: (event) => {
				event.stopPropagation();
				props.onPinnedDragStart(entry.row.id);
			},
			onDragOver: (event) => {
				if (dragKind !== 'pinned') return;
				event.preventDefault();
				props.onDragOver(entry.row.id);
			},
			onDrop: (event) => {
				if (dragKind !== 'pinned') return;
				event.preventDefault();
				props.onPinnedDrop(entry.row.id);
			},
		},
		h(SessionRow, {
			variant: props.variant,
			row,
			now: props.now,
			pinned: true,
			archived: props.archived instanceof Set && props.archived.has(row.id),
			selected: props.selection.includes(row.id),
			busy: props.busy,
			t,
			onOpen: props.onOpen,
			onSelect: props.onSelect,
			onDelete: props.onDelete,
			onPin: props.onPin,
			onUnpin: props.onUnpin,
			onArchive: props.onArchive,
			onUnarchive: props.onUnarchive,
			onDragStart: () => props.onPinnedDragStart(entry.row.id),
		}),
	);
}

/**
 * @param props - `{ variant, groups, pinned, expanded, selection, busy, t,
 *   onOpen, onToggle, onSelectionChange, onDelete, onNewSession,
 *   onRenameWorkspace, onDeleteWorkspace, onRenameFolder, onDeleteFolder,
 *   onPin, onUnpin, onMoveSession, onMoveFolder, onReorderPinned }`; see
 *   roadmap §3.1.
 * @returns the tree element.
 */
export function SessionTree(props) {
	const t = props.t;
	const variant = props.variant === 'sidebar' ? 'sidebar' : 'panel';
	const groups = Array.isArray(props.groups) ? props.groups : [];
	const pinned = Array.isArray(props.pinned) ? props.pinned : [];
	const expanded = Array.isArray(props.expanded) ? props.expanded : [];
	const selection = Array.isArray(props.selection) ? props.selection : [];
	const archived = props.archived instanceof Set ? props.archived : new Set();
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

	const [drag, setDrag] = React.useState(null);
	const [dropTarget, setDropTarget] = React.useState(null);

	const clearDrag = () => {
		setDrag(null);
		setDropTarget(null);
	};

	const endDrop = (group) => {
		const current = drag;
		clearDrag();
		if (current === null) return;
		if (current.kind === 'session') {
			if (typeof props.onMoveSession === 'function') props.onMoveSession(current.id, group.key);
			return;
		}
		if (current.kind === 'folder') {
			if (typeof props.onMoveFolder === 'function') props.onMoveFolder(current.key, group.key);
		}
	};

	/**
	 * Drop a dragged Session before one row, or at the end of a folder.
	 * @param group - target group.
	 * @param before - anchor Session id, or undefined to append.
	 */
	const endRowDrop = (group, before) => {
		const current = drag;
		clearDrag();
		if (current === null || current.kind !== 'session' || current.id === before) return;
		if (typeof props.onMoveSession === 'function') props.onMoveSession(current.id, group.key, before);
	};

	/**
	 * Drop a dragged entry on one pinned slot: pinned entries reorder, a Session
	 * or folder may also land in a pinned folder.
	 * @param target - pinned session id or folder key.
	 */
	const pinnedDrop = (target) => {
		const current = drag;
		clearDrag();
		if (current === null || current.key === target) return;
		const folderKey = parseKey(target) !== null;
		if (current.kind === 'pinned') {
			if (typeof props.onReorderPinned === 'function') props.onReorderPinned(current.key, target);
			return;
		}
		if (current.kind === 'session' && folderKey) {
			if (typeof props.onMoveSession === 'function') props.onMoveSession(current.id, target);
			return;
		}
		if (current.kind === 'folder' && folderKey) {
			if (typeof props.onMoveFolder === 'function') props.onMoveFolder(current.key, target);
		}
	};

	return h(
		'div',
		{
			className: variant === 'sidebar' ? 'sa-tree sa-tree-sidebar' : 'sa-tree',
			role: 'tree',
			onDragEnd: clearDrag,
		},
		pinned.length === 0
			? null
			: h(
					'div',
					{ className: 'sa-pinned' },
					pinned.map((entry) =>
						h(PinnedEntry, {
							key: entry.kind === 'folder' ? entry.group.key : entry.row.id,
							entry,
							now,
							variant,
							t,
							expanded,
							selection,
							busy,
							dropTarget,
							dragKind: drag === null ? null : drag.kind,
							archived,
							onToggle: props.onToggle,
							onOpen: open,
							onSelect: select,
							onDelete: props.onDelete,
							onNewSession: props.onNewSession,
							onRenameWorkspace: props.onRenameWorkspace,
							onDeleteWorkspace: props.onDeleteWorkspace,
							onRenameFolder: props.onRenameFolder,
							onDeleteFolder: props.onDeleteFolder,
							onPin: props.onPin,
							onUnpin: props.onUnpin,
							onArchive: props.onArchive,
							onUnarchive: props.onUnarchive,
							onDragOver: setDropTarget,
							onPinnedDragStart: (key) => setDrag({ kind: 'pinned', key }),
							onPinnedDrop: pinnedDrop,
							onPinnedDropRow: endRowDrop,
						}),
					),
				),
		groups.map((group) =>
			h(Group, {
				key: group.key === '' ? 'ungrouped' : group.key,
				group,
				kind: group.kind,
				pinned: false,
				now,
				expanded: expanded.includes(group.key),
				selection,
				busy,
				variant,
				t,
				dropTarget,
				dragKind: drag === null ? null : drag.kind,
				archived,
				onToggle: props.onToggle,
				onOpen: open,
				onSelect: select,
				onDelete: props.onDelete,
				onNewSession: props.onNewSession,
				onRenameWorkspace: props.onRenameWorkspace,
				onDeleteWorkspace: props.onDeleteWorkspace,
				onRenameFolder: props.onRenameFolder,
				onDeleteFolder: props.onDeleteFolder,
				onPin: props.onPin,
				onUnpin: props.onUnpin,
				onDragStart: (target) => {
					if (target.id !== undefined) setDrag({ kind: 'session', id: target.id });
					else setDrag({ kind: 'folder', key: target.key });
				},
				onSessionDragStart: (row) => setDrag({ kind: 'session', id: row.id }),
				onDragOver: setDropTarget,
				onDrop: endDrop,
				onDropRow: endRowDrop,
			}),
		),
	);
}
