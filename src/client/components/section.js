/**
 * Session management page: browse the live client catalog as the stored tree
 * (pinned entries first, then folders), select, delete, open. Mounted by the
 * `settings.section` seat.
 *
 * The tree is display-only: moving a Session between folders or pinning it only
 * changes where it is drawn, never its native Workspace membership.
 */
import React, { h } from '../react.js';
import { postDelete } from '../api.js';
import { orderedUnique } from '../format.js';
import { markVanished, useVanished } from '../stores/vanished.js';
import { adoptWorkspaces, refreshLayout, saveLayout, useTree } from '../stores/tree.js';
import {
	addFolder,
	isSessionId,
	parseKey,
	pinItem,
	placeSession,
	removeFolder,
	renameFolder,
	reorderFolders,
	reorderPinned,
	unpinItem,
	workspaceKey,
	workspaceOrder,
} from '../layout.js';
import { buildTreeModel, selectRows } from '../tree-model.js';
import { SessionTree } from './session-tree.js';
import { SidebarSwitch } from './pref-switch.js';

/**
 * @param props - slot props: locale seat, session catalog, workspace snapshot,
 *   plus navigation and workspace actions (`openSession`, `startSession`,
 *   `renameWorkspace`, `deleteWorkspace`, `syncWorkspaceOrder`).
 * @returns the settings section element.
 */
export function SessionAdminSection(props) {
	const t = props.t;
	const catalog = props.useSessions((state) => state);
	const workspaces = props.useWorkspaces((state) => state);
	const archivedIds = workspaces.archivedSessionIds;
	const goneIds = useVanished();
	const treeState = useTree();
	const layout = treeState.layout;

	const [query, setQuery] = React.useState('');
	const [selected, setSelected] = React.useState([]);
	const [confirming, setConfirming] = React.useState(null);
	const [busy, setBusy] = React.useState(false);
	const [notice, setNotice] = React.useState(null);
	const [collapsed, setCollapsed] = React.useState([]);
	const [dialog, setDialog] = React.useState(null);
	const [showArchived, setShowArchived] = React.useState(false);

	React.useEffect(() => {
		if (!treeState.loaded && !treeState.loading) void refreshLayout();
	}, [treeState.loaded, treeState.loading]);

	const archived = React.useMemo(() => new Set(archivedIds), [archivedIds]);
	const gone = React.useMemo(() => new Set(goneIds), [goneIds]);

	/** Catalog rows worth showing, newest first; blank sessions hidden like the shipped tree. */
	const { rows } = React.useMemo(
		() => selectRows({ catalog, archivedIds, goneIds, showArchived }),
		[catalog, archivedIds, goneIds, showArchived],
	);

	const warning = React.useMemo(() => {
		if (treeState.error !== '') return t('treeFailed', { message: treeState.error });
		return null;
	}, [treeState.error, t]);

	/** Workspace lookup: id to its label and its folder key. */
	const workspaceInfo = React.useMemo(() => {
		const map = new Map();
		for (const workspace of workspaces.items) {
			const label = workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.path;
			map.set(workspace.workspaceId, { label, key: workspaceKey(workspace.workspaceId) });
		}
		return map;
	}, [workspaces.items]);

	/** The stored layout merged with every known Workspace, so a drag never hits a missing key. */
	const base = React.useMemo(() => adoptWorkspaces(layout, [...workspaceInfo.keys()]), [layout, workspaceInfo]);

	/** The folder key a Session would fall into without any recorded move. */
	const defaultKey = React.useCallback(
		(id) => {
			for (const workspace of workspaces.items) {
				if (workspace.sessionIds.includes(id)) return workspaceKey(workspace.workspaceId);
			}
			return '';
		},
		[workspaces.items],
	);

	const needle = query.trim().toLowerCase();
	const matches = React.useCallback(
		(row) => {
			if (needle === '') return true;
			const title = row.title ?? '';
			const cwd = row.cwd ?? '';
			return title.toLowerCase().includes(needle) || cwd.toLowerCase().includes(needle);
		},
		[needle],
	);

	const model = React.useMemo(
		() =>
			buildTreeModel({
				rows,
				base,
				workspaceInfo,
				defaultKey,
				needle,
				t,
				matches,
			}),
		[rows, base, workspaceInfo, defaultKey, needle, t, matches],
	);
	const { groups, groupByKey, rowById, pinned, pinnedKeys, rest, visibleRows, selectable } = model;
	const visibleIds = React.useMemo(() => new Set(selectable.map((row) => row.id)), [selectable]);
	const selectedIds = selected.filter((id) => visibleIds.has(id));
	const allSelected = selectable.length > 0 && selectedIds.length === selectable.length;
	const archivableIds = selectedIds.filter((id) => !archived.has(id) && !gone.has(id));
	const unarchivableIds = selectedIds.filter((id) => archived.has(id) && !gone.has(id));
	const expandedKeys = [...groupByKey.keys()].filter((key) => !collapsed.includes(key));

	const toggle = (id) => {
		setSelected((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));
	};

	const toggleAll = () => {
		if (allSelected) {
			setSelected((previous) => previous.filter((id) => !visibleIds.has(id)));
			return;
		}
		setSelected((previous) => orderedUnique([...previous, ...selectable.map((row) => row.id)]));
	};

	const toggleGroup = (key) => {
		setCollapsed((previous) => (previous.includes(key) ? previous.filter((value) => value !== key) : [...previous, key]));
	};

	const openSession = (id) => {
		if (typeof props.openSession !== 'function') return;
		props.openSession(id);
	};

	/** Persist one layout change, surfacing a failed save in the notice line. */
	const persist = (next) => {
		void saveLayout(next).then((state) => {
			if (state.error !== '') setNotice({ kind: 'error', text: t('treeFailed', { message: state.error }) });
		});
	};

	/** Keep the native sidebar order in step after dragging folders. */
	const syncWorkspaceOrder = (next) => {
		if (typeof props.syncWorkspaceOrder !== 'function') return;
		void Promise.resolve(props.syncWorkspaceOrder(workspaceOrder(next))).catch(() => {});
	};

	const runDelete = async (ids) => {
		setBusy(true);
		setNotice(null);
		const result = await postDelete(ids);
		setBusy(false);
		setConfirming(null);
		if (!result.ok) {
			setNotice({ kind: 'error', text: t('noticeFailed', { message: result.error }) });
			return;
		}
		markVanished(result.deleted);
		setSelected([]);
		void refreshLayout();
		if (result.skipped.length === 0) {
			setNotice({ kind: 'ok', text: t('noticeDeleted', { count: result.deleted.length }) });
			return;
		}
		const reasons = result.skipped.map((row) => `${row.id.slice(0, 18)}… ${row.reason}`).join('；');
		setNotice({
			kind: result.deleted.length === 0 ? 'error' : 'ok',
			text: `${t('noticeDeleted', { count: result.deleted.length })} ${t('noticeSkipped', { count: result.skipped.length, reasons })}`,
		});
	};

	/** Remote failures surface as `{ ok: false, error }` instead of throwing. */
	const failureText = (result) => {
		if (result === undefined || result === null || result.ok !== false) return null;
		const error = result.error;
		if (error === undefined || error === null) return t('noticeFailed', { message: 'unknown' });
		return t('noticeFailed', { message: error.message ?? String(error) });
	};

	const startSession = (group) => {
		if (typeof props.startSession !== 'function') return;
		const parsed = parseKey(group.key);
		if (parsed !== null && parsed.kind === 'workspace') props.startSession(parsed.value);
		else props.startSession();
	};

	/**
	 * Pin a Session or a folder. A Session is also pinned natively, so the shipped
	 * sidebar and ours agree; a folder pin stays local to this tree.
	 * @param key - Session id or folder key.
	 */
	const pin = (key) => {
		persist(pinItem(base, key));
		if (isSessionId(key) && typeof props.pinSession === 'function') props.pinSession(key);
	};

	/**
	 * Unpin a Session or a folder, clearing the native pin for a Session too.
	 * @param key - Session id or folder key.
	 */
	const unpin = (key) => {
		persist(unpinItem(base, key));
		if (isSessionId(key) && typeof props.unpinSession === 'function') props.unpinSession(key);
	};

	/**
	 * Drop one Session into a folder, or before one of its rows.
	 * @param id - dragged Session.
	 * @param key - target folder key.
	 * @param before - anchor Session id, or undefined to append.
	 */
	const moveSession = (id, key, before) => {
		const parsed = parseKey(key);
		if (parsed === null && key !== '') return;
		const group = groupByKey.get(key);
		const order = group === undefined ? [] : group.sessions.map((row) => row.id);
		persist(placeSession(base, id, key, before, defaultKey(id), order));
	};

	/** A running Session refuses archiving until its work is stopped on purpose. */
	const activeRefusal = (error) => {
		if (!(error instanceof Error) || error.name !== 'WorkspaceArchiveError') return false;
		return error.rpcError?.code === 'workspace/session-active';
	};

	/**
	 * Archive one Session, or stop its running work first when confirmed.
	 * @param id - Session id.
	 * @param stopActivity - stop the running turn before archiving.
	 */
	const archiveRow = async (id, stopActivity) => {
		if (typeof props.archiveSession !== 'function') return;
		setBusy(true);
		setNotice(null);
		try {
			await props.archiveSession(id, stopActivity === true ? { stopActivity: true } : undefined);
			setDialog(null);
			setNotice({ kind: 'ok', text: t('noticeArchived') });
		} catch (error) {
			if (stopActivity !== true && activeRefusal(error)) {
				const row = catalog.byId[id];
				const title = row !== undefined && row.title !== undefined && row.title !== '' ? row.title : t('unnamed');
				setDialog({ kind: 'archive', sessionId: id, label: title });
			} else {
				setNotice({
					kind: 'error',
					text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }),
				});
			}
		} finally {
			setBusy(false);
		}
	};

	const unarchiveRow = async (id) => {
		if (typeof props.unarchiveSession !== 'function') return;
		setNotice(null);
		try {
			await props.unarchiveSession(id);
			setNotice({ kind: 'ok', text: t('noticeUnarchived') });
		} catch (error) {
			setNotice({
				kind: 'error',
				text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }),
			});
		}
	};

	/** Archive every selected Session that is not archived yet; running ones stay put. */
	const bulkArchive = async () => {
		if (archivableIds.length === 0) {
			setNotice({ kind: 'error', text: t('bulkNone') });
			return;
		}
		setBusy(true);
		setNotice(null);
		let done = 0;
		let refused = 0;
		for (const id of archivableIds) {
			try {
				await props.archiveSession(id);
				done += 1;
			} catch (error) {
				if (activeRefusal(error)) {
					refused += 1;
					continue;
				}
				setNotice({
					kind: 'error',
					text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }),
				});
				setBusy(false);
				return;
			}
		}
		setBusy(false);
		setSelected([]);
		const parts = [t('noticeArchivedCount', { count: done })];
		if (refused > 0) parts.push(t('bulkRunningRefused', { count: refused }));
		setNotice({ kind: refused > 0 ? 'error' : 'ok', text: parts.join(' ') });
	};

	/** Restore every selected Session that is archived; others are skipped. */
	const bulkUnarchive = async () => {
		if (unarchivableIds.length === 0) return;
		setBusy(true);
		setNotice(null);
		let done = 0;
		for (const id of unarchivableIds) {
			try {
				await props.unarchiveSession(id);
				done += 1;
			} catch (error) {
				setNotice({
					kind: 'error',
					text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }),
				});
				setBusy(false);
				return;
			}
		}
		setBusy(false);
		setSelected([]);
		setNotice({ kind: 'ok', text: t('noticeUnarchivedCount', { count: done }) });
	};

	const moveFolder = (moved, before) => {
		const next = reorderFolders(base, moved, before);
		persist(next);
		syncWorkspaceOrder(next);
	};

	const reorderPinnedEntry = (moved, before) => persist(reorderPinned(base, moved, before));

	const renameWorkspace = async (dialogState) => {
		const title = dialogState.value.trim();
		if (title === '' || typeof props.renameWorkspace !== 'function') return;
		setDialog(null);
		setNotice(null);
		try {
			const message = failureText(await props.renameWorkspace(dialogState.workspaceId, title));
			if (message !== null) setNotice({ kind: 'error', text: message });
		} catch (error) {
			setNotice({ kind: 'error', text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }) });
		}
	};

	const deleteWorkspace = async (dialogState) => {
		if (typeof props.deleteWorkspace !== 'function') return;
		setDialog(null);
		setNotice(null);
		try {
			const message = failureText(await props.deleteWorkspace(dialogState.workspaceId));
			if (message !== null) setNotice({ kind: 'error', text: message });
		} catch (error) {
			setNotice({ kind: 'error', text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }) });
		}
	};

	const submitDialog = () => {
		if (dialog === null) return;
		const value = typeof dialog.value === 'string' ? dialog.value.trim() : '';
		if (dialog.kind === 'renameWorkspace') {
			void renameWorkspace(dialog);
			return;
		}
		if (dialog.kind === 'renameSession') {
			setDialog(null);
			setNotice(null);
			if (value === '' || typeof props.renameSession !== 'function') return;
			void Promise.resolve(props.renameSession(dialog.sessionId, value))
				.then((result) => {
					if (result !== undefined && result !== null && result.ok === false) {
						setNotice({ kind: 'error', text: t('noticeFailed', { message: result.error?.message ?? '' }) });
					}
				})
				.catch((error) => {
					setNotice({
						kind: 'error',
						text: t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }),
					});
				});
			return;
		}
		if (dialog.kind === 'deleteWorkspace') {
			void deleteWorkspace(dialog);
			return;
		}
		if (dialog.kind === 'archive') {
			setDialog(null);
			void archiveRow(dialog.sessionId, true);
			return;
		}
		setDialog(null);
		setNotice(null);
		if (dialog.kind === 'newFolder') {
			if (value === '') return;
			if (base.folders.includes(value)) {
				setNotice({ kind: 'error', text: t('folderExists', { name: value }) });
				return;
			}
			persist(addFolder(base, value));
			return;
		}
		if (dialog.kind === 'renameFolder') {
			if (value === '' || value === dialog.name) return;
			if (base.folders.includes(value)) {
				setNotice({ kind: 'error', text: t('folderExists', { name: value }) });
				return;
			}
			persist(renameFolder(base, dialog.name, value));
			return;
		}
		if (dialog.kind === 'deleteFolder') persist(removeFolder(base, dialog.name));
	};

	const header = h(
		'div',
		{ className: 'sa-head' },
		h('h2', null, t('title')),
		h('p', { className: 'sa-desc' }, t('desc')),
	);

	const toolbar = h(
		'div',
		{ className: 'sa-toolbar' },
		h('input', {
			className: 'sa-search',
			type: 'search',
			value: query,
			placeholder: t('search'),
			'aria-label': t('search'),
			onChange: (event) => setQuery(event.target.value),
		}),
		h(
			'button',
			{
				className: 'sa-btn',
				type: 'button',
				disabled: busy || treeState.saving,
				onClick: () => setDialog({ kind: 'newFolder', value: '' }),
			},
			t('newFolder'),
		),
		h(
			'button',
			{
				className: showArchived ? 'sa-btn sa-btn-active' : 'sa-btn',
				type: 'button',
				'aria-pressed': showArchived,
				onClick: () => setShowArchived((value) => !value),
			},
			t('showArchived'),
		),
		h(
			'button',
			{ className: 'sa-btn', type: 'button', onClick: toggleAll, disabled: selectable.length === 0 || busy },
			allSelected ? t('clear') : t('selectAll'),
		),
		h('span', { className: 'sa-count' }, t('selectedCount', { count: selectedIds.length })),
		h(
			'button',
			{
				className: 'sa-btn',
				type: 'button',
				disabled: archivableIds.length === 0 || busy,
				onClick: () => void bulkArchive(),
			},
			t('archive'),
		),
		h(
			'button',
			{
				className: 'sa-btn',
				type: 'button',
				disabled: unarchivableIds.length === 0 || busy,
				onClick: () => void bulkUnarchive(),
			},
			t('unarchive'),
		),
		h(
			'button',
			{
				className: 'sa-btn sa-btn-danger',
				type: 'button',
				disabled: selectedIds.length === 0 || busy,
				onClick: () => setConfirming(selectedIds.slice()),
			},
			t('delete'),
		),
	);

	const confirmingTitle = (() => {
		if (confirming === null || confirming.length !== 1) return '';
		const row = catalog.byId[confirming[0]];
		return row !== undefined && row.title !== undefined && row.title !== '' ? row.title : t('unnamed');
	})();

	const confirmBar =
		confirming === null
			? null
			: h(
					'div',
					{ className: 'sa-confirm', role: 'alert' },
					h(
						'div',
						{ className: 'sa-confirm-text' },
						h(
							'div',
							null,
							confirming.length === 1
								? t('confirmOneTitle', { title: confirmingTitle })
								: t('confirmTitle', { count: confirming.length }),
						),
						h(
							'div',
							{ className: 'sa-confirm-body' },
							confirming.length === 1 ? t('confirmOneBody') : t('confirmBody'),
						),
					),
					h(
						'button',
						{ className: 'sa-btn', type: 'button', disabled: busy, onClick: () => setConfirming(null) },
						t('cancel'),
					),
					h(
						'button',
						{ className: 'sa-btn sa-btn-danger-solid', type: 'button', disabled: busy, onClick: () => runDelete(confirming) },
						t('confirmDelete'),
					),
				);

	const dialogTitle = (() => {
		if (dialog === null) return '';
		if (dialog.kind === 'renameWorkspace') return t('renameWorkspaceTitle');
		if (dialog.kind === 'renameSession') return t('renameSessionTitle');
		if (dialog.kind === 'deleteWorkspace') return t('deleteWorkspaceTitle');
		if (dialog.kind === 'newFolder') return t('newFolderTitle');
		if (dialog.kind === 'renameFolder') return t('renameFolderTitle');
		if (dialog.kind === 'archive') return t('archiveConfirmTitle');
		return t('deleteFolderTitle');
	})();

	const dialogBody = (() => {
		if (dialog === null) return null;
		if (dialog.kind === 'deleteWorkspace') {
			return h('p', { className: 'sa-dialog-body' }, t('deleteWorkspaceBody', { name: dialog.label }));
		}
		if (dialog.kind === 'deleteFolder') {
			return h('p', { className: 'sa-dialog-body' }, t('deleteFolderBody', { name: dialog.name }));
		}
		if (dialog.kind === 'archive') {
			return h('p', { className: 'sa-dialog-body' }, t('archiveConfirmBody', { title: dialog.label }));
		}
		const label =
			dialog.kind === 'renameFolder' || dialog.kind === 'newFolder'
				? t('folderName')
				: dialog.kind === 'renameSession'
					? t('renameSessionTitle')
					: t('renameWorkspaceTitle');
		return h('input', {
			className: 'sa-search',
			type: 'text',
			autoFocus: true,
			value: dialog.value ?? '',
			placeholder: t('folderName'),
			'aria-label': label,
			onChange: (event) => setDialog({ ...dialog, value: event.target.value }),
			onKeyDown: (event) => {
				if (event.key === 'Enter') submitDialog();
				if (event.key === 'Escape') setDialog(null);
			},
		});
	})();

	const dialogConfirmLabel = (() => {
		if (dialog === null) return t('confirmDelete');
		if (dialog.kind === 'renameWorkspace' || dialog.kind === 'renameFolder' || dialog.kind === 'renameSession') return t('save');
		if (dialog.kind === 'newFolder') return t('create');
		if (dialog.kind === 'archive') return t('archiveConfirmAction');
		return t('confirmDelete');
	})();

	const dialogView =
		dialog === null
			? null
			: h(
					'div',
					{ className: 'sa-mask', onClick: () => setDialog(null) },
					h(
						'div',
						{
							className: 'sa-dialog',
							role: 'dialog',
							'aria-modal': 'true',
							onClick: (event) => event.stopPropagation(),
						},
						h('div', { className: 'sa-dialog-title' }, dialogTitle),
						dialogBody,
						h(
							'div',
							{ className: 'sa-dialog-actions' },
							h('button', { className: 'sa-btn', type: 'button', onClick: () => setDialog(null) }, t('cancel')),
							h(
								'button',
								{
									className:
										dialog.kind === 'deleteWorkspace' || dialog.kind === 'deleteFolder'
											? 'sa-btn sa-btn-danger-solid'
											: 'sa-btn sa-btn-primary',
									type: 'button',
									onClick: submitDialog,
								},
								dialogConfirmLabel,
							),
						),
					),
				);

	const noticeLine =
		notice === null
			? null
			: h('p', { className: notice.kind === 'error' ? 'sa-notice sa-notice-error' : 'sa-notice sa-notice-ok' }, notice.text);

	const warningLine =
		warning === null
			? null
			: h(
					'p',
					{ className: 'sa-notice sa-notice-error' },
					warning,
					' ',
					h(
						'button',
						{ className: 'sa-btn', type: 'button', onClick: () => void refreshLayout() },
						t('retry'),
					),
				);

	let body;
	if (rows.length === 0) {
		body = h('div', { className: 'sa-empty' }, t('empty'));
	} else if (visibleRows.length === 0 && pinned.length === 0) {
		body = h('div', { className: 'sa-empty' }, t('noMatch'));
	} else {
		body = h(SessionTree, {
			variant: 'panel',
			groups: rest,
			pinned,
			expanded: expandedKeys,
			selection: selectedIds,
			busy: busy || treeState.saving,
			onOpen: openSession,
			onToggle: toggleGroup,
			onSelectionChange: toggle,
			archived,
			onDelete: (row) => setConfirming([row.id]),
			onArchive: (id) => void archiveRow(id, false),
			onUnarchive: (id) => void unarchiveRow(id),
			onNewSession: startSession,
			onRenameWorkspace: (group) => {
				const parsed = parseKey(group.key);
				if (parsed === null) return;
				setDialog({ kind: 'renameWorkspace', workspaceId: parsed.value, label: group.label, value: group.label });
			},
			onDeleteWorkspace: (group) => {
				const parsed = parseKey(group.key);
				if (parsed === null) return;
				setDialog({ kind: 'deleteWorkspace', workspaceId: parsed.value, label: group.label });
			},
			onRenameFolder: (group) => setDialog({ kind: 'renameFolder', name: group.label, value: group.label }),
			onDeleteFolder: (group) => setDialog({ kind: 'deleteFolder', name: group.label }),
			onPin: pin,
			onUnpin: unpin,
			onMoveSession: moveSession,
			onMoveFolder: moveFolder,
			onReorderPinned: reorderPinnedEntry,
			t,
		});
	}

	return h(
		'div',
		{ className: 'sa-root' },
		header,
		h(SidebarSwitch, { t }),
		toolbar,
		confirmBar,
		warningLine,
		noticeLine,
		body,
		dialogView,
		h('p', { className: 'sa-hint' }, t('hint')),
	);
}
