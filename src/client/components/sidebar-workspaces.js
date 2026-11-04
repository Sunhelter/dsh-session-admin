/**
 * The `sidebar.workspaces` seat replacement: the shared Session card list,
 * drawn in the narrow column. The shipped sidebar keeps its own shell — brand
 * row, new-session button, collapse toggle, footer actions and settings row all
 * stay where they were; only the workspace/session browsing region is ours.
 *
 * Nothing here declares child slots, so ui-sidebar keeps owning them.
 */
import React, { h } from '../react.js';
import {
	IconChecklistOutlineRegular,
	IconCloseFillRegular,
	IconProjectAddOutlineRegular,
	IconSearchOutlineRegular,
	Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { postDelete } from '../api.js';
import { buildCardList, selectRows } from '../tree-model.js';
import { togglePin, usePinned } from '../stores/pins.js';
import { markVanished, useVanished } from '../stores/vanished.js';
import { useAutomationActivity, useAutomationSessionIds } from '../stores/automation.js';
import { SessionTree } from './session-tree.js';

/**
 * @param props - `sidebar.workspaces` seat props (`wide`, `expandSidebar`) plus
 *   the actions wired in `apply.js`: `openSession`, `pinSession`,
 *   `unpinSession`, `archiveSession`, `unarchiveSession`, `renameSession`,
 *   `createWorkspace`, `startSession`, `getDirectoryFlow`.
 * @returns the header and card list region, or null in rail mode.
 */
export function SidebarWorkspaces(props) {
	const t = props.t;
	const wide = props.wide !== false;
	const catalog = props.useSessions((state) => state);
	const workspaces = props.useWorkspaces((state) => state);
	const goneIds = useVanished();
	const statusHook = typeof props.useSessionStatus === 'function' ? props.useSessionStatus : () => undefined;
	const statuses = statusHook((state) => state);
	const pinnedIds = usePinned();

	const [query, setQuery] = React.useState('');
	const [searchExpanded, setSearchExpanded] = React.useState(false);
	const [selectMode, setSelectMode] = React.useState(false);
	const [selection, setSelection] = React.useState([]);
	const [dialog, setDialog] = React.useState(null);
	const [flow, setFlow] = React.useState(null);
	const [notice, setNotice] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const treeRef = React.useRef(null);
	const shellRef = React.useRef(null);
	const searchRef = React.useRef(null);
	const automation = useAutomationSessionIds();
	const activityAt = useAutomationActivity();

	React.useEffect(() => {
		// The panel entries are a direct `nav` of the sidebar shell; our own node
		// sits a few wrappers deeper, so climb until a parent owns a `nav` child.
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
		shellRef.current = shell;
		shell.setAttribute('data-session-admin-sidebar', '');
		return () => {
			shell.removeAttribute('data-session-admin-sidebar');
			shell.removeAttribute('data-session-admin-selecting');
			shellRef.current = null;
		};
	}, []);

	// Select mode owns the shell's new-session button: the shipped sidebar keeps
	// it above this seat, so it is hidden while selection is on. The button has no
	// stable class, only its localized label, so it is tagged by label instead.
	React.useEffect(() => {
		const shell = shellRef.current;
		if (shell === null) return;
		if (selectMode !== true || wide === false) {
			shell.removeAttribute('data-session-admin-selecting');
			return;
		}
		const labels = new Set(['新建会话', '新会话', 'New session', 'New chat']);
		// The shipped sidebar also renders a fixed new-session button inside the
		// titlebar (28px) on desktop; only the in-flow button below the brand row is
		// the slot select mode takes over. Pick the tallest non-fixed match.
		let newSession = null;
		for (const element of shell.querySelectorAll('button')) {
			// The logo row is itself a new-session button in the shipped sidebar; only
			// the standalone button below it belongs to select mode.
			if (element.closest('[data-window-drag]') !== null) continue;
			const label = (element.getAttribute('aria-label') ?? '').trim();
			const text = (element.textContent ?? '').trim();
			const named =
				labels.has(label) ||
				labels.has(text) ||
				(typeof element.className === 'string' && element.className.includes('newSession'));
			if (!named) continue;
			if (window.getComputedStyle(element).position === 'fixed') continue;
			if (element.offsetHeight === 0) continue;
			if (newSession === null || element.offsetHeight > newSession.offsetHeight) newSession = element;
		}
		if (newSession !== null) {
			newSession.setAttribute('data-session-admin-new-session', '');
			const style = window.getComputedStyle(newSession);
			const top = Number.parseFloat(style.marginTop);
			const bottom = Number.parseFloat(style.marginBottom);
			const height = newSession.offsetHeight;
			const gap = Number.isFinite(bottom) ? bottom : 0;
			if (height > 0) shell.style.setProperty('--sa-select-header-h', `${Math.round(height)}px`);
			shell.style.setProperty('--sa-select-header-mb', `${Math.round(Number.isFinite(top) ? top : 0) + gap}px`);
		}
		shell.setAttribute('data-session-admin-selecting', '');
	}, [selectMode, wide]);

	React.useEffect(() => {
		if (searchExpanded) searchRef.current?.focus({ preventScroll: true });
	}, [searchExpanded]);

	const { rows, currentId } = React.useMemo(
		() =>
			selectRows({
				catalog,
				archivedIds: workspaces.archivedSessionIds,
				goneIds,
				showArchived: false,
				activityAt,
			}),
		[catalog, workspaces.archivedSessionIds, goneIds, activityAt],
	);

	/** Session id to its Workspace name, for the second line of every card. */
	const workspaceLabels = React.useMemo(() => {
		const map = new Map();
		for (const workspace of workspaces.items) {
			const label = workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.path;
			for (const id of workspace.sessionIds) map.set(id, label);
		}
		return map;
	}, [workspaces.items]);

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

	const { pinned, groups, visibleRows } = buildCardList({
		rows,
		pinnedIds,
		needle,
		matches,
		now: Date.now(),
		t,
	});

	const unread = React.useMemo(() => {
		const ids = new Set();
		for (const row of rows) {
			const status = statuses instanceof Map ? statuses.get(row.id) : undefined;
			if (status !== undefined && status !== null && status.completionUnread === true) ids.add(row.id);
		}
		return ids;
	}, [rows, statuses]);

	const openSession = (id) => {
		if (typeof props.openSession === 'function') props.openSession(id);
	};

	const rowById = React.useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);

	const titleOf = (id) => {
		const row = rowById.get(id);
		return row === undefined || typeof row.title !== 'string' || row.title.trim() === ''
			? t('unnamed')
			: row.title;
	};

	/** Our pin list and the shipped one stay in step for Sessions. */
	const pin = (id) => {
		togglePin(id);
		if (typeof props.pinSession === 'function') void props.pinSession(id);
	};

	const unpin = (id) => {
		togglePin(id);
		if (typeof props.unpinSession === 'function') void props.unpinSession(id);
	};

	/** A running Session refuses to archive; the refusal carries the activity kind. */
	const activeRefusal = (error) =>
		error instanceof Error &&
		error.name === 'WorkspaceArchiveError' &&
		error.rpcError !== undefined &&
		error.rpcError !== null &&
		error.rpcError.code === 'workspace/session-active';

	const archiveRow = async (id, stopActivity) => {
		if (typeof props.archiveSession !== 'function') return;
		try {
			await props.archiveSession(id, stopActivity === true ? { stopActivity: true } : undefined);
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
		} catch (error) {
			console.warn('[session-admin] unarchive failed:', error);
		}
	};

	/**
	 * Open the shipped directory dialog. Its occupant is handed in by `apply.js`
	 * — the slot it lives in belongs to the entry we shadow — so this is the same
	 * dialog the native sidebar shows, columns, path editing and folder creation
	 * included.
	 */
	const addWorkspace = () => {
		const api = typeof props.getDirectoryFlow === 'function' ? props.getDirectoryFlow() : undefined;
		if (api === undefined) {
			setNotice(t('directoryUnavailable'));
			return;
		}
		setFlow({ api, busy: false });
	};

	/**
	 * Adopt the picked directory as a Workspace, close the dialog and open a
	 * fresh Session there. Our list groups by Session rather than Workspace, so
	 * without the Session the new Workspace leaves nothing to look at — this is
	 * also what the shipped sidebar does after a pick.
	 * @param path - absolute directory path.
	 */
	const adopt = async (path) => {
		if (typeof path !== 'string' || path === '') return;
		setFlow((current) => (current === null ? current : { ...current, busy: true }));
		let result;
		try {
			result = await props.createWorkspace(path);
		} catch (error) {
			result = { ok: false, error: { message: error instanceof Error ? error.message : String(error) } };
		}
		setFlow(null);
		const ok = result === undefined || result === null || result.ok !== false;
		if (!ok) {
			const detail = result?.error?.message ?? '';
			setNotice(detail === '' ? t('createWorkspaceFailed') : `${t('createWorkspaceFailed')}: ${detail}`);
			console.warn('[session-admin] create workspace failed:', path, result);
			return;
		}
		const workspaceId = result?.workspace?.workspaceId ?? result?.workspaceId;
		if (typeof workspaceId === 'string' && typeof props.startSession === 'function') {
			props.startSession(workspaceId);
		}
	};

	const exitSelect = () => {
		setSelectMode(false);
		setSelection([]);
	};
	const toggleSelect = (id) => {
		setSelection((previous) => (previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]));
	};
	const pinSelected = () => {
		for (const id of selection) {
			if (pinnedIds.includes(id)) continue;
			pin(id);
		}
		exitSelect();
	};
	const deleteSelected = async () => {
		if (selection.length === 0) return;
		setBusy(true);
		const result = await postDelete(selection);
		setBusy(false);
		if (!result.ok) {
			setNotice(t('noticeFailed', { message: result.error?.message ?? '' }));
			console.warn('[session-admin] delete failed:', result.error);
			return;
		}
		markVanished(result.deleted);
		exitSelect();
	};

	const confirmDialog = async () => {
		if (dialog === null) return;
		const current = dialog;
		setDialog(null);
		if (current.kind === 'archive') {
			await archiveRow(current.sessionId, true);
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
		setBusy(true);
		const result = await postDelete([current.sessionId]);
		setBusy(false);
		if (!result.ok) {
			console.warn('[session-admin] delete failed:', result.error);
			return;
		}
		markVanished(result.deleted);
	};

	const groupLabel = pinned.length > 0 ? t('pinnedSection') : (groups[0]?.label ?? t('sectionSessions'));

	// Select mode reuses the shipped new-session row: same height, our label and
	// close button.
	const selectBar =
		selectMode === false
			? null
			: h(
					'div',
					{ className: 'sa-ws-header sa-ws-header-select' },
					h(
						'span',
						{ className: 'sa-ws-label' },
						selection.length === 0 ? t('selectChats') : t('selectedChats', { count: selection.length }),
					),
					h(
						'button',
						{
							className: 'sa-ws-select-close',
							type: 'button',
							'aria-label': t('cancel'),
							onClick: exitSelect,
						},
						h(IconCloseFillRegular, { size: 12 }),
					),
				);

	// Header: group label, search, select-mode entry, add workspace.
	const header = h(
		'div',
		{ className: 'sa-ws-header' },
		searchExpanded && selectMode === false
			? null
			: h('span', { className: 'sa-ws-label' }, groupLabel),
		selectMode === true
			? null
			: h(
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
		selectMode === true || searchExpanded
			? null
			: h(
					Tooltip,
					{ label: t('selectChats'), side: 'bottom', delayMs: 500, portal: true },
					h(
						'button',
						{
							className: 'sa-ws-search-btn',
							type: 'button',
							'aria-label': t('selectChats'),
							onClick: () => {
								setQuery('');
								setSearchExpanded(false);
								setSelectMode(true);
								setSelection([]);
							},
						},
						h(IconChecklistOutlineRegular, null),
					),
				),
		selectMode === true || searchExpanded
			? null
			: h(
					'div',
					{ className: 'sa-ws-actions' },
					h(
						Tooltip,
						{ label: t('addWorkspace'), side: 'bottom', delayMs: 500, portal: true },
						h(
							'button',
							{
								className: 'sa-ws-icon-btn',
								type: 'button',
								'aria-label': t('addWorkspace'),
								onClick: addWorkspace,
							},
							h(IconProjectAddOutlineRegular, null),
						),
					),
				),
	);

	// Rail mode hides this region natively; there is nothing to draw.
	if (!wide) return null;

	const body =
		visibleRows.length === 0
			? h('div', { className: 'sa-shell-empty' }, t(needle === '' ? 'empty' : 'noMatch'))
			: h(SessionTree, {
					variant: 'sidebar',
					currentId,

					pinned,
					groups,
					workspaceLabels,
					archived: new Set(),
					unread,
					automation,
					selection,
					selectMode,
					busy,
					hideFirstLabel: true,
					t,
					onSelectionChange: toggleSelect,
					onOpen: openSession,
					onPin: pin,
					onUnpin: unpin,
					onRename: (row) =>
						setDialog({
							kind: 'renameSession',
							sessionId: row.id,
							value: typeof row.title === 'string' ? row.title : '',
						}),
					onArchive: (id) => void archiveRow(id, false),
					onUnarchive: (id) => void unarchiveRow(id),
					onDelete: (row) => setDialog({ kind: 'delete', sessionId: row.id, title: titleOf(row.id) }),
				});

	const dialogTitle = (state) => {
		if (state.kind === 'archive') return t('archiveConfirmTitle');
		if (state.kind === 'renameSession') return t('renameSessionTitle');
		return t('confirmOneTitle', { title: state.title });
	};

	const dialogBody = (state) => {
		if (state.kind === 'archive') return h('p', { className: 'sa-dialog-body' }, t('archiveConfirmBody'));
		if (state.kind === 'renameSession') {
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
						h('div', { className: 'sa-dialog-title' }, dialogTitle(dialog)),
						dialogBody(dialog),
						h(
							'div',
							{ className: 'sa-dialog-actions' },
							h(
								'button',
								{ className: 'sa-btn', type: 'button', disabled: busy, onClick: () => setDialog(null) },
								t('cancel'),
							),
							h(
								'button',
								{
									className: dialog.kind === 'delete' ? 'sa-btn sa-btn-danger-solid' : 'sa-btn sa-btn-primary',
									type: 'button',
									disabled: busy,
									onClick: () => void confirmDialog(),
								},
								dialog.kind === 'archive'
									? t('archiveConfirmAction')
									: dialog.kind === 'renameSession'
										? t('save')
										: t('confirmDelete'),
							),
						),
					),
				);

	// The shipped dialog paints its own modal mask; we only mount it and hand it
	// the open/busy conversation plus the adopt callback.
	const flowView =
		flow === null
			? null
			: h(flow.api.Component, {
					open: true,
					busy: flow.busy,
					listDirectory: flow.api.listDirectory,
					createDirectory: flow.api.createDirectory,
					t: flow.api.t,
					onPicked: (path) => void adopt(path),
					onCancel: () => setFlow(null),
				});

	const noticeView = notice === '' ? null : h('div', { className: 'sa-shell-empty' }, notice);

	// Bulk bar: pin and delete, only while selection is on.
	const bulkView =
		selectMode === false
			? null
			: h(
					'div',
					{ className: 'sa-bulk' },
					h(
						'button',
						{
							className: 'sa-bulk-btn',
							type: 'button',
							disabled: busy || selection.length === 0,
							onClick: pinSelected,
						},
						t('pin'),
					),
					h(
						'button',
						{
							className: 'sa-bulk-btn sa-bulk-btn-danger',
							type: 'button',
							disabled: busy || selection.length === 0,
							onClick: () => void deleteSelected(),
						},
						t('delete'),
					),
				);

	return h(
		'div',
		{
			className: 'sa-sidebar-tree',
			ref: treeRef,
			onKeyDown: (event) => {
				if (event.key !== 'Escape' || selectMode !== true) return;
				exitSelect();
			},
		},
		selectBar,
		header,
		noticeView,
		body,
		bulkView,
		dialogView,
		flowView,
	);
}
