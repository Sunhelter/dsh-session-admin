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
 * One Session's row menu: pin, archive (or restore), delete.
 * @param props - `{ row, pinned, archived, t, open, onOpenChange, onDelete,
 *   onPin, onUnpin, onArchive, onUnarchive }`.
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
					draggable: false,
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
 * One Session row.
 * @param props - `{ variant, row, now, pinned, archived, selected, busy, t,
 *   onOpen, onSelect, onDelete, onPin, onUnpin, onArchive, onUnarchive,
 *   onDragStart }`.
 * @returns the row element.
 */
function SessionRow(props) {
	const { variant, row, now, pinned, archived, unread, selected, busy, t, onOpen, onSelect, onDelete } = props;
	const title = rowTitle(row, t);
	const [menuOpen, setMenuOpen] = React.useState(false);

	if (variant === 'sidebar') {
		const rowClass = [
			'sa-session',
			'sa-session-sidebar',
			pinned === true ? 'sa-pinned-row' : '',
			archived === true ? 'sa-archived' : '',
			menuOpen ? 'sa-menu-open' : '',
			props.dropBefore === true ? 'sa-drop-before' : '',
		]
			.filter((part) => part !== '')
			.join(' ');
		const togglePin = (event) => {
			event.stopPropagation();
			const handler = pinned === true ? props.onUnpin : props.onPin;
			if (typeof handler === 'function') handler(row.id);
		};
		return h(
			'div',
			{
				className: rowClass,
				'data-session-id': row.id,
				role: 'treeitem',
				'aria-selected': false,
				draggable: busy !== true,
				onDragStart: (event) => {
					event.stopPropagation();
					if (typeof props.onDragStart === 'function') props.onDragStart(row);
				},
			},
			pinned === true
				? h('span', { className: 'sa-slot sa-pin' }, h(IconPinOutlineRegular, null))
				: null,
			h(
				'button',
				{
					className: 'sa-open',
					type: 'button',
					title,
					disabled: busy || archived === true,
					onClick: () => onOpen(row.id),
				},
				h('span', { className: 'sa-title' }, title),
				archived === true ? h('span', { className: 'sa-tag' }, t('archivedTag')) : null,
				statusDot(row, t, unread),
			),
			h('span', { className: 'sa-time' }, relativeLabel(row.updatedAt, now, t)),
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
							draggable: false,
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
					onArchive: props.onArchive,
					onUnarchive: props.onUnarchive,
					t,
					open: menuOpen,
					onOpenChange: setMenuOpen,
					onDelete: (target) => {
						if (typeof onDelete === 'function') onDelete(target);
					},
					onPin: (id) => {
						if (typeof props.onPin === 'function') props.onPin(id);
					},
					onUnpin: (id) => {
						if (typeof props.onUnpin === 'function') props.onUnpin(id);
					},
					onRename: (target) => {
						if (typeof props.onRename === 'function') props.onRename(target);
					},
				}),
			),
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
			statusDot(row, t, unread),
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
				onRename: (target) => {
					if (typeof props.onRename === 'function') props.onRename(target);
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
	const unread = props.unread instanceof Set ? props.unread : new Set();
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
						draggable: false,
						'aria-label': kind === 'custom' ? t('folderActions', { name: group.label }) : t('workspaceActions', { name: group.label }),
						onPointerDown: (event) => event.stopPropagation(),
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
								draggable: false,
								'aria-label': t('newSessionIn', { name: group.label }),
								onPointerDown: (event) => event.stopPropagation(),
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
						unread: unread.has(row.id),
						selected: selection.includes(row.id),
						busy,
						t,
						dropBefore: props.dropTarget === `row:${row.id}`,
						onOpen: props.onOpen,
						onSelect: props.onSelect,
						onDelete: props.onDelete,
						onPin: props.onPin,
						onUnpin: props.onUnpin,
						onArchive: props.onArchive,
						onUnarchive: props.onUnarchive,
						onRename: props.onRename,
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
	const { entry, t, dragKind, dropTarget } = props;
	const key = entry.kind === 'folder' ? entry.group.key : entry.row.id;
	const wrap = (draggable, onDragStart, children) =>
		h(
			'div',
			{
				className: [
					'sa-pinned-entry',
					entry.kind === 'folder' ? 'sa-pinned-folder-entry' : '',
					props.dropBefore === true ? 'sa-drop-before' : '',
					props.dropAfter === true ? 'sa-drop-after' : '',
				]
					.filter((part) => part !== '')
					.join(' '),
				draggable,
				'data-pinned-key': key,
				onDragStart:
					draggable === true
						? (event) => {
								event.stopPropagation();
								onDragStart();
							}
						: undefined,
				onDragOver: (event) => {
					if (dragKind !== 'pinned') return;
					event.preventDefault();
					event.stopPropagation();
					const rect = event.currentTarget.getBoundingClientRect();
					props.onPinHover(key, event.clientY > rect.top + rect.height / 2);
				},
				onDrop: (event) => {
					if (dragKind !== 'pinned') return;
					event.preventDefault();
					event.stopPropagation();
					const rect = event.currentTarget.getBoundingClientRect();
					props.onPinDrop(key, event.clientY > rect.top + rect.height / 2);
				},
			},
			children,
		);
	if (entry.kind === 'folder') {
		return wrap(
			false,
			() => {},
			h(Group, {
				group: entry.group,
				kind: entry.group.kind,
				pinned: true,
				now: props.now,
				expanded: props.expanded.includes(entry.group.key),
				selection: props.selection,
				busy: props.busy,
				variant: props.variant,
				t,
				archived: props.archived,
				unread: props.unread,
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
				onRename: props.onRename,
				onArchive: props.onArchive,
				onUnarchive: props.onUnarchive,
				onDragStart: (group) => props.onPinnedDragStart(group.key),
				onDragOver: props.onDragOver,
				onDrop: (group) => props.onPinnedDrop(group.key),
				onDropRow: (group, before) => props.onPinnedDropRow(group, before),
			}),
		);
	}
	const row = entry.row;
	return wrap(props.busy !== true, () => props.onPinnedDragStart(entry.row.id), [
		h(SessionRow, {
			variant: props.variant,
			row,
			now: props.now,
			pinned: true,
			archived: props.archived instanceof Set && props.archived.has(row.id),
			unread: props.unread instanceof Set && props.unread.has(row.id),
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
			onRename: props.onRename,
			onDragStart: () => props.onPinnedDragStart(entry.row.id),
		}),
	]);
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
	const unread = props.unread instanceof Set ? props.unread : new Set();
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
	const [pinHover, setPinHover] = React.useState(null);

	const clearDrag = () => {
		setDrag(null);
		setDropTarget(null);
		setPinHover(null);
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

	/**
	 * Reorder one pinned entry before the slot under the pointer.
	 * @param key - pinned entry key under the pointer.
	 * @param after - true when the pointer sits in the lower half of the entry.
	 */
	const pinDropAt = (key, after) => {
		const current = drag;
		clearDrag();
		if (current === null || current.kind !== 'pinned') return;
		const keys = pinned.map((item) => (item.kind === 'folder' ? item.group.key : item.row.id));
		const index = keys.indexOf(key);
		const before = after ? keys[index + 1] : key;
		if (before === current.key) return;
		if (typeof props.onReorderPinned === 'function') props.onReorderPinned(current.key, before);
	};

	const pinDropTail = () => {
		const current = drag;
		clearDrag();
		if (current === null || current.kind !== 'pinned') return;
		if (typeof props.onReorderPinned === 'function') props.onReorderPinned(current.key, undefined);
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
							onRename: props.onRename,
							dropBefore:
								pinHover !== null &&
								drag !== null &&
								drag.kind === 'pinned' &&
								pinHover.key === (entry.kind === 'folder' ? entry.group.key : entry.row.id) &&
								pinHover.after !== true,
							dropAfter:
								pinHover !== null &&
								drag !== null &&
								drag.kind === 'pinned' &&
								pinHover.key === (entry.kind === 'folder' ? entry.group.key : entry.row.id) &&
								pinHover.after === true,
							onPinHover: (key, after) => setPinHover({ key, after }),
							onPinDrop: pinDropAt,
							onDragOver: setDropTarget,
							onPinnedDragStart: (key) => setDrag({ kind: 'pinned', key }),
							onPinnedDrop: pinnedDrop,
							onPinnedDropRow: endRowDrop,
						}),
					),
					h('div', {
						className: 'sa-pinned-tail',
						onDragOver: (event) => {
							if (drag === null || drag.kind !== 'pinned') return;
							event.preventDefault();
							setPinHover({ key: '', after: true });
						},
						onDrop: (event) => {
							if (drag === null || drag.kind !== 'pinned') return;
							event.preventDefault();
							pinDropTail();
						},
					}),
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
				archived,
				unread,
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
				onRename: props.onRename,
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
