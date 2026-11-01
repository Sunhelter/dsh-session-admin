/**
 * The `sidebar.workspaces` seat replacement: the shared session tree, drawn in the
 * narrow column. The shipped sidebar keeps its own shell — brand row, new-session
 * button, collapse toggle, footer actions and settings row all stay where they
 * were; only the workspace/session browsing region is ours.
 *
 * Pinning is bridged: our order lives in `layout.json`, and pinning a Session
 * also pins it natively so the shipped sidebar agrees.
 *
 * Nothing here declares child slots, so ui-sidebar keeps owning them.
 */
import React, { h } from '../react.js';
import {
	IconChevronsUpDownOutlineRegular,
	IconClockOutlineRegular,
	IconCloseFillRegular,
	IconProjectAddOutlineRegular,
	IconRefreshOutlineRegular,
	IconSearchOutlineRegular,
	IconSlidersTwoOutlineRegular,
	Menu,
	Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { postDelete } from '../api.js';
import { buildTreeModel, selectRows } from '../tree-model.js';
import { adoptWorkspaces, refreshLayout, saveLayout, useTree } from '../stores/tree.js';
import {
	emptyLayout,
	frontFolder,
	isSessionId,
	removeFolder,
	renameFolder,
	parseKey,
	pinItem,
	placeSession,
	reorderFolders,
	reorderPinned,
	unpinItem,
	workspaceKey,
	workspaceOrder,
} from '../layout.js';
import { markVanished, useVanished } from '../stores/vanished.js';
import { SessionTree } from './session-tree.js';

/**
 * @param props - `sidebar.workspaces` seat props (`wide`, `expandSidebar`) plus
 *   the actions wired in `apply.js`: `openSession`, `startSession`,
 *   `syncWorkspaceOrder`, `pinSession`, `unpinSession`, `archiveSession`,
 *   `unarchiveSession`.
 * @returns the header and tree region, or null in rail mode.
 */
export function SidebarWorkspaces(props) {
	const t = props.t;
	const wide = props.wide !== false;
	const catalog = props.useSessions((state) => state);
	const workspaces = props.useWorkspaces((state) => state);
	const goneIds = useVanished();
	const statusHook = typeof props.useSessionStatus === 'function' ? props.useSessionStatus : () => undefined;
	const statuses = statusHook((state) => state);
	const treeState = useTree();
	const layout = treeState.layout;

	const [collapsedGroups, setCollapsedGroups] = React.useState([]);
	const [query, setQuery] = React.useState('');
	const [searchExpanded, setSearchExpanded] = React.useState(false);
	const [orderBy, setOrderBy] = React.useState('manual');
	const [viewOpen, setViewOpen] = React.useState(false);
	const [dialog, setDialog] = React.useState(null);
	const [browse, setBrowse] = React.useState(null);
	const [notice, setNotice] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const treeRef = React.useRef(null);
	const searchRef = React.useRef(null);

	// The panel list (插件 / 插件市场 / …) is ui-sidebar's own `nav`; leaving it in
	// place would sit above the tree. The switch means "this region replaces the
	// native browser", so hide that sibling row while the seat is occupied and put
	// it back when our registration is disposed.
	React.useEffect(() => {
		// The panel list is a direct `nav` of the sidebar shell; our own node sits a
		// few wrappers deeper, so climb until a parent owns a `nav` child.
		let current = treeRef.current;
		let shell = null;
		for (let depth = 0; depth < 8 && current !== null; depth += 1) {
			const parent = current.parentElement;
			if (parent === null) break;
			if (parent.querySelector(':scope > nav') !== null) {
				shell = parent;
				break;
			}
			current = parent;
		}
		if (shell === null) return undefined;
		shell.setAttribute('data-session-admin-sidebar', '');
		return () => {
			shell.removeAttribute('data-session-admin-sidebar');
		};
	}, []);

	React.useEffect(() => {
		if (!treeState.loaded && !treeState.loading) void refreshLayout();
	}, [treeState.loaded, treeState.loading]);

	React.useEffect(() => {
		if (searchExpanded) searchRef.current?.focus({ preventScroll: true });
	}, [searchExpanded]);

	const { rows } = React.useMemo(
		() =>
			selectRows({
				catalog,
				archivedIds: workspaces.archivedSessionIds,
				goneIds,
				showArchived: false,
			}),
		[catalog, workspaces.archivedSessionIds, goneIds],
	);

	const workspaceInfo = React.useMemo(() => {
		const map = new Map();
		for (const workspace of workspaces.items) {
			const label = workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.path;
			map.set(workspace.workspaceId, { label, key: workspaceKey(workspace.workspaceId) });
		}
		return map;
	}, [workspaces.items]);

	const base = React.useMemo(() => adoptWorkspaces(layout, [...workspaceInfo.keys()]), [layout, workspaceInfo]);

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
			const title = typeof row.title === 'string' ? row.title : '';
			const cwd = typeof row.cwd === 'string' ? row.cwd : '';
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
				orderBy,
			}),
		[rows, base, workspaceInfo, defaultKey, needle, t, matches, orderBy],
	);
	const { groupByKey, pinned, rest, visibleRows, rowById } = model;

	const unread = React.useMemo(() => {
		const ids = new Set();
		for (const row of rows) {
			const status = statuses instanceof Map ? statuses.get(row.id) : undefined;
			if (status !== undefined && status !== null && status.completionUnread === true) ids.add(row.id);
		}
		return ids;
	}, [rows, statuses]);
	const expandedKeys = [...groupByKey.keys()].filter((key) => !collapsedGroups.includes(key));

	const persist = (next) => {
		void saveLayout(next).then((state) => {
			if (state.error !== '') console.warn('[session-admin] layout save failed:', state.error);
		});
	};

	const syncWorkspaceOrder = (next) => {
		if (typeof props.syncWorkspaceOrder !== 'function') return;
		void Promise.resolve(props.syncWorkspaceOrder(workspaceOrder(next))).catch(() => {});
	};

	const openSession = (id) => {
		if (typeof props.openSession === 'function') props.openSession(id);
	};

	const startSession = (group) => {
		if (typeof props.startSession !== 'function') return;
		if (group !== undefined) {
			const parsed = parseKey(group.key);
			if (parsed !== null && parsed.kind === 'workspace') {
				props.startSession(parsed.value);
				return;
			}
		}
		props.startSession();
	};

	const toggleGroup = (key) => {
		setCollapsedGroups((previous) =>
			previous.includes(key) ? previous.filter((value) => value !== key) : [...previous, key],
		);
	};

	const moveSession = (id, key, before) => {
		const parsed = parseKey(key);
		if (parsed === null && key !== '') return;
		const group = groupByKey.get(key);
		const order = group === undefined ? [] : group.sessions.map((row) => row.id);
		persist(placeSession(base, id, key, before, defaultKey(id), order));
	};

	const moveFolder = (moved, before) => {
		const next = reorderFolders(base, moved, before);
		persist(next);
		syncWorkspaceOrder(next);
	};

	/** Our pin list is global; the shipped sidebar keeps its own per-workspace one. */
	const pin = (key) => {
		persist(pinItem(base, key));
		if (isSessionId(key) && typeof props.pinSession === 'function') void props.pinSession(key);
	};

	const unpin = (key) => {
		persist(unpinItem(base, key));
		if (isSessionId(key) && typeof props.unpinSession === 'function') void props.unpinSession(key);
	};

	/**
	 * Forget every recorded choice: folders, placement, pins, per-folder order and
	 * folder order all fall back to the native Workspace snapshot.
	 */
	const resetLayout = () => {
		const ids = workspaces.items.map((item) => item.workspaceId);
		persist(adoptWorkspaces(emptyLayout(), ids));
	};

	/** A running Session refuses to archive; the refusal carries the activity kind. */
	const activeRefusal = (error) =>
		error instanceof Error &&
		error.name === 'WorkspaceArchiveError' &&
		error.rpcError !== undefined &&
		error.rpcError !== null &&
		error.rpcError.code === 'workspace/session-active';

	const titleOf = (id) => {
		const row = rowById.get(id);
		return row === undefined || typeof row.title !== 'string' || row.title.trim() === ''
			? t('unnamed')
			: row.title;
	};

	const archiveRow = async (id, stopActivity) => {
		if (typeof props.archiveSession !== 'function') return;
		try {
			await props.archiveSession(id, stopActivity === true ? { stopActivity: true } : undefined);
			await refreshLayout();
		} catch (error) {
			if (activeRefusal(error)) {
				setDialog({ kind: 'archive', sessionId: id, title: titleOf(id) });
				return;
			}
			console.warn('[session-admin] archive failed:', error);
		}
	};

	const unarchiveRow = async (id) => {
		if (typeof props.unarchiveSession !== 'function') return;
		try {
			await props.unarchiveSession(id);
			await refreshLayout();
		} catch (error) {
			console.warn('[session-admin] unarchive failed:', error);
		}
	};

	/** Adopt one directory as a Workspace and close the picker. */
	const adopt = async (path) => {
		if (typeof path !== 'string' || path === '') return;
		setBrowse(null);
		setBusy(true);
		const result = await props.createWorkspace(path);
		setBusy(false);
		const ok = result !== undefined && result !== null && result.ok !== false;
		if (ok) {
			const workspaceId = result?.value?.workspace?.workspaceId;
			if (typeof workspaceId === 'string' && workspaceId !== '') {
				const next = frontFolder(base, workspaceKey(workspaceId));
				persist(next);
				syncWorkspaceOrder(next);
			}
		}
		if (!ok) {
			const detail = result?.error?.message ?? '';
			setNotice(detail === '' ? t('createWorkspaceFailed') : `${t('createWorkspaceFailed')}: ${detail}`);
			console.warn('[session-admin] create workspace failed:', path, result);
		}
	};

	/** Load one directory level of the in-app picker. */
	const loadDirectory = async (path) => {
		if (typeof props.listDirectory !== 'function') {
			setBrowse({ error: t('directoryUnavailable') });
			return;
		}
		setBrowse({ loading: true });
		try {
			const listing = await props.listDirectory(path);
			setBrowse({ listing });
		} catch (error) {
			setBrowse({ error: t('directoryUnavailable') });
			console.warn('[session-admin] list directory failed:', error);
		}
	};

	/**
	 * Open the directory dialog; a browse host has no OS chooser to call, and
	 * asking it anyway leaves the request hanging, so skip straight to the
	 * listing primitives.
	 */
	const addWorkspace = async () => {
		await loadDirectory(undefined);
	};

	const createWorkspace = async (path) => {
		if (typeof props.createWorkspace !== 'function') return false;
		const result = await props.createWorkspace(path);
		if (result === undefined || result === null) return false;
		return result.ok !== false;
	};

	const confirmDialog = async () => {
		if (dialog === null) return;
		const current = dialog;
		setDialog(null);
		if (current.kind === 'archive') {
			await archiveRow(current.sessionId, true);
			return;
		}
		if (current.kind === 'renameWorkspace') {
			const value = typeof current.value === 'string' ? current.value.trim() : '';
			if (value === '' || typeof props.renameWorkspace !== 'function') return;
			setBusy(true);
			setNotice('');
			try {
				const result = await props.renameWorkspace(current.workspaceId, value);
				if (result !== undefined && result !== null && result.ok === false) {
					setNotice(t('noticeFailed', { message: result.error?.message ?? '' }));
					console.warn('[session-admin] rename workspace failed:', result.error);
				}
			} catch (error) {
				setNotice(t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }));
				console.warn('[session-admin] rename workspace failed:', error);
			}
			setBusy(false);
			return;
		}
		if (current.kind === 'deleteWorkspace') {
			if (typeof props.deleteWorkspace !== 'function') return;
			setBusy(true);
			const result = await props.deleteWorkspace(current.workspaceId);
			setBusy(false);
			if (result !== undefined && result !== null && result.ok === false) {
				console.warn('[session-admin] delete workspace failed:', result.error);
			} else {
				await refreshLayout();
			}
			return;
		}
		if (current.kind === 'renameSession') {
			const value = typeof current.value === 'string' ? current.value.trim() : '';
			if (value === '' || typeof props.renameSession !== 'function') return;
			setBusy(true);
			try {
				const result = await props.renameSession(current.sessionId, value);
				if (result !== undefined && result !== null && result.ok === false) {
					setNotice(t('noticeFailed', { message: result.error?.message ?? '' }));
					console.warn('[session-admin] rename session failed:', result.error);
				}
			} catch (error) {
				setNotice(t('noticeFailed', { message: error instanceof Error ? error.message : String(error) }));
				console.warn('[session-admin] rename session failed:', error);
			}
			setBusy(false);
			return;
		}
		if (current.kind === 'renameFolder') {
			const value = typeof current.value === 'string' ? current.value.trim() : '';
			if (value === '' || value === current.name) return;
			if (base.folders.includes(value)) return;
			persist(renameFolder(base, current.name, value));
			return;
		}
		if (current.kind === 'deleteFolder') {
			persist(removeFolder(base, current.name));
			return;
		}
		setBusy(true);
		const result = await postDelete([current.sessionId]);
		setBusy(false);
		if (!result.ok) {
			console.warn('[session-admin] delete failed:', result.error);
			return;
		}
		markVanished(result.deleted);
		await refreshLayout();
	};

	const viewMenu = h(Menu, {
		open: viewOpen,
		onClose: () => setViewOpen(false),
		portal: true,
		closeOnPointerLeave: true,
		dense: true,
		align: 'end',
		selectedIds: [orderBy],
		items: [
			{ type: 'label', id: 'order-by', text: t('orderBy') },
			{ id: 'manual', label: t('orderManual'), icon: h(IconChevronsUpDownOutlineRegular, null) },
			{ id: 'updated', label: t('orderUpdated'), icon: h(IconClockOutlineRegular, null) },
			{ type: 'label', id: 'reset-label', text: t('resetSection') },
			{ id: 'reset', label: t('resetLayout'), icon: h(IconRefreshOutlineRegular, null) },
		],
		onSelect: (id) => {
			if (id === 'manual' || id === 'updated') setOrderBy(id);
			if (id === 'reset') resetLayout();
			setViewOpen(false);
		},
		anchor: h(
			Tooltip,
			{ label: t('viewOptions'), side: 'bottom', delayMs: 500, portal: true },
			h(
				'button',
				{
					className: 'sa-ws-icon-btn',
					type: 'button',
					'aria-label': t('viewOptions'),
					onClick: () => setViewOpen((value) => !value),
				},
				h(IconSlidersTwoOutlineRegular, null),
			),
		),
	});

	const header = h(
		'div',
		{ className: 'sa-ws-header' },
		searchExpanded ? null : h('span', { className: 'sa-ws-label' }, t('sectionWorkspaces')),
		h(
			'div',
			{ className: searchExpanded ? 'sa-ws-search sa-ws-search-expanded' : 'sa-ws-search' },
			h(
				Tooltip,
				{ label: t('search'), side: 'bottom', delayMs: 500, portal: true, disabled: searchExpanded },
				h(
					'button',
					{
						className: 'sa-ws-search-btn',
						type: 'button',
						'aria-label': t('searchSessions'),
						'aria-expanded': searchExpanded,
						onClick: () => setSearchExpanded(true),
					},
					h(IconSearchOutlineRegular, { size: searchExpanded ? 11 : 14 }),
				),
			),
			searchExpanded
				? h('input', {
						ref: searchRef,
						className: 'sa-ws-search-input',
						type: 'text',
						placeholder: t('searchPlaceholder'),
						value: query,
						onChange: (event) => setQuery(event.target.value),
						onKeyDown: (event) => {
							if (event.key !== 'Escape') return;
							setQuery('');
							setSearchExpanded(false);
						},
					})
				: null,
			searchExpanded
				? h(
						'button',
						{
							className: 'sa-ws-search-clear',
							type: 'button',
							'aria-label': t('clear'),
							onClick: () => {
								setQuery('');
								setSearchExpanded(false);
							},
						},
						h(IconCloseFillRegular, null),
					)
				: null,
		),
		searchExpanded
			? null
			: h(
					'div',
					{ className: 'sa-ws-actions' },
					viewMenu,
					h(
						Tooltip,
						{ label: t('addWorkspace'), side: 'bottom', delayMs: 500, portal: true },
						h(
							'button',
							{
								className: 'sa-ws-icon-btn',
								type: 'button',
								'aria-label': t('addWorkspace'),
								onClick: () => void addWorkspace(),
							},
							h(IconProjectAddOutlineRegular, null),
						),
					),
				),
	);

	if (!wide) return null;

	const body =
		visibleRows.length === 0
			? h('div', { className: 'sa-shell-empty' }, t(needle === '' ? 'empty' : 'noMatch'))
			: h(SessionTree, {
					variant: 'sidebar',
					groups: rest,
					pinned,
					archived: new Set(),
					unread,
					expanded: expandedKeys,
					selection: [],
					busy,
					t,
					onOpen: openSession,
					onToggle: toggleGroup,
					onSelectionChange: () => {},
					onNewSession: startSession,
					onPin: pin,
					onUnpin: unpin,
					onRenameWorkspace: (group) => {
						const parsed = parseKey(group.key);
						if (parsed !== null && parsed.kind === 'workspace') {
							setDialog({ kind: 'renameWorkspace', workspaceId: parsed.value, value: group.label });
						}
					},
					onDeleteWorkspace: (group) => {
						const parsed = parseKey(group.key);
						if (parsed !== null && parsed.kind === 'workspace') {
							setDialog({ kind: 'deleteWorkspace', workspaceId: parsed.value, name: group.label });
						}
					},
					onRenameFolder: (group) => setDialog({ kind: 'renameFolder', name: group.label, value: group.label }),
					onDeleteFolder: (group) => setDialog({ kind: 'deleteFolder', name: group.label }),
					onRename: (row) =>
						setDialog({
							kind: 'renameSession',
							sessionId: row.id,
							value: typeof row.title === 'string' ? row.title : '',
						}),
					onArchive: (id) => void archiveRow(id, false),
					onUnarchive: (id) => void unarchiveRow(id),
					onDelete: (row) => setDialog({ kind: 'delete', sessionId: row.id, title: titleOf(row.id) }),
					onMoveSession: moveSession,
					onMoveFolder: moveFolder,
					onReorderPinned: (moved, before) => persist(reorderPinned(base, moved, before)),
				});

	const dialogTitle = (state) => {
		if (state.kind === 'archive') return t('archiveConfirmTitle');
		if (state.kind === 'renameWorkspace') return t('renameWorkspaceTitle');
		if (state.kind === 'deleteWorkspace') return t('deleteWorkspaceTitle');
		if (state.kind === 'renameSession') return t('renameSessionTitle');
		if (state.kind === 'renameFolder') return t('renameFolderTitle');
		if (state.kind === 'deleteFolder') return t('deleteFolderTitle');
		return t('confirmOneTitle', { title: state.title });
	};

	const dialogBody = (state) => {
		if (state.kind === 'archive') return h('p', { className: 'sa-dialog-body' }, t('archiveConfirmBody'));
		if (state.kind === 'renameWorkspace') {
			return h('input', {
				className: 'sa-input',
				type: 'text',
				value: state.value,
				autoFocus: true,
				onChange: (event) => setDialog({ ...state, value: event.target.value }),
				onKeyDown: (event) => {
					if (event.key === 'Enter') void confirmDialog();
					if (event.key === 'Escape') setDialog(null);
				},
			});
		}
		if (state.kind === 'renameSession' || state.kind === 'renameFolder') {
			return h('input', {
				className: 'sa-input',
				type: 'text',
				value: state.value,
				autoFocus: true,
				onChange: (event) => setDialog({ ...state, value: event.target.value }),
				onKeyDown: (event) => {
					if (event.key === 'Enter') void confirmDialog();
					if (event.key === 'Escape') setDialog(null);
				},
			});
		}
		if (state.kind === 'deleteWorkspace') {
			return h('p', { className: 'sa-dialog-body' }, t('deleteWorkspaceBody', { name: state.name }));
		}
		if (state.kind === 'deleteFolder') {
			return h('p', { className: 'sa-dialog-body' }, t('deleteFolderBody', { name: state.name }));
		}
		return h('p', { className: 'sa-dialog-body' }, t('confirmOneBody'));
	};

	const dialogView =
		dialog === null
			? null
			: h(
					'div',
					{ className: 'sa-mask' },
					h(
						'div',
						{ className: 'sa-dialog', role: 'dialog', 'aria-modal': 'true' },
						h(
							'div',
							{ className: 'sa-dialog-title' },
							dialogTitle(dialog),
						),
						dialogBody(dialog),
						h(
							'div',
							{ className: 'sa-dialog-actions' },
							h(
								'button',
								{
									className: 'sa-btn',
									type: 'button',
									disabled: busy,
									onClick: () => setDialog(null),
								},
								t('cancel'),
							),
							h(
								'button',
								{
									className:
										dialog.kind === 'delete' ||
										dialog.kind === 'deleteWorkspace' ||
										dialog.kind === 'deleteFolder'
											? 'sa-btn sa-btn-danger-solid'
											: 'sa-btn sa-btn-primary',
									type: 'button',
									disabled: busy,
									onClick: () => void confirmDialog(),
								},
								dialog.kind === 'archive'
									? t('archiveConfirmAction')
									: dialog.kind === 'renameWorkspace' ||
											dialog.kind === 'renameFolder' ||
											dialog.kind === 'renameSession'
										? t('save')
										: t('confirmDelete'),
							),
						),
					),
				);

	const pickerView =
		browse === null
			? null
			: h(
					'div',
					{ className: 'sa-mask' },
					h(
						'div',
						{ className: 'sa-dialog sa-picker', role: 'dialog', 'aria-modal': 'true' },
						h('div', { className: 'sa-dialog-title' }, t('pickDirectory')),
						browse.loading === true
							? h('div', { className: 'sa-picker-status' }, t('loading'))
							: browse.error !== undefined
								? h('div', { className: 'sa-picker-status' }, browse.error)
								: h(
										'div',
										{ className: 'sa-picker-body' },
										h(
											'div',
											{ className: 'sa-picker-crumbs' },
											browse.listing.crumbs.map((crumb, index) =>
												h(
													'button',
													{
														key: crumb.path,
														className:
															index === browse.listing.crumbs.length - 1
																? 'sa-picker-crumb sa-picker-crumb-current'
																: 'sa-picker-crumb',
														type: 'button',
														title: crumb.path,
														onClick: () => void loadDirectory(crumb.path),
													},
													crumb.name === '' ? '/' : crumb.name,
												),
											),
										),
										h(
											'div',
											{ className: 'sa-picker-list' },
											browse.listing.entries.map((entry) =>
												h(
													'button',
													{
														key: entry.path,
														className: 'sa-picker-row',
														type: 'button',
														title: entry.path,
														onClick: () => void loadDirectory(entry.path),
													},
													h('span', { className: 'sa-picker-folder' }, '▸'),
													h('span', { className: 'sa-picker-name' }, entry.name),
												),
											),
											browse.listing.entries.length === 0
												? h('div', { className: 'sa-picker-status' }, t('noSubdirectories'))
												: null,
										),
										browse.listing.truncated === true
											? h('div', { className: 'sa-picker-status' }, t('directoryTruncated'))
											: null,
									),
						h(
							'div',
							{ className: 'sa-dialog-actions' },
							h(
								'button',
								{ className: 'sa-btn', type: 'button', disabled: busy, onClick: () => setBrowse(null) },
								t('cancel'),
							),
							h(
								'button',
								{
									className: 'sa-btn sa-btn-primary',
									type: 'button',
									disabled: busy || browse.loading === true || browse.error !== undefined,
									onClick: () => void adopt(browse.listing.path),
								},
								t('chooseDirectory'),
							),
						),
					),
				);

	const noticeView = notice === '' ? null : h('div', { className: 'sa-shell-empty' }, notice);

	return h('div', { className: 'sa-sidebar-tree', ref: treeRef }, header, noticeView, body, dialogView, pickerView);
}
