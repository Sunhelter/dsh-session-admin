/**
 * Session management page: browse the live client catalog grouped by native
 * workspaces, select, delete, open. Mounted by the `settings.section` seat.
 */
import React, { h } from '../react.js';
import { postDelete } from '../api.js';
import { orderedUnique } from '../format.js';
import { CSS } from '../styles.js';
import { markVanished, useVanished } from '../stores/vanished.js';
import { SessionTree } from './session-tree.js';
import { SidebarSwitch } from './pref-switch.js';

/**
 * @param props - slot props: locale seat, session catalog, workspace snapshot,
 *   plus `openSession(id)` for navigation.
 * @returns the settings section element.
 */
export function SessionAdminSection(props) {
	const t = props.t;
	const catalog = props.useSessions((state) => state);
	const workspaces = props.useWorkspaces((state) => state);
	const archivedIds = workspaces.archivedSessionIds;
	const goneIds = useVanished();

	const [query, setQuery] = React.useState('');
	const [selected, setSelected] = React.useState([]);
	const [confirming, setConfirming] = React.useState(null);
	const [busy, setBusy] = React.useState(false);
	const [notice, setNotice] = React.useState(null);
	const [collapsed, setCollapsed] = React.useState([]);
	const [dialog, setDialog] = React.useState(null);

	const archived = React.useMemo(() => new Set(archivedIds), [archivedIds]);
	const gone = React.useMemo(() => new Set(goneIds), [goneIds]);

	/** The Session the conversation view retains: the one blank row the tree keeps. */
	const currentId = React.useMemo(() => {
		for (const id of catalog.ids) {
			const row = catalog.byId[id];
			if (row !== undefined && (row.retainedBy?.mainView ?? 0) > 0) return id;
		}
		return undefined;
	}, [catalog]);

	/** Catalog rows worth showing, newest first; blank sessions hidden like the shipped tree. */
	const rows = React.useMemo(() => {
		const list = [];
		for (const id of catalog.ids) {
			const row = catalog.byId[id];
			if (row === undefined) continue;
			if (archived.has(id) || gone.has(id)) continue;
			if (row.blank === true && id !== currentId) continue;
			list.push(row);
		}
		list.sort((left, right) => right.updatedAt - left.updatedAt);
		return list;
	}, [catalog, archived, gone, currentId]);

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

	/** Groups in display order: native workspaces, then unaccounted rows. */
	const groups = React.useMemo(() => {
		const byId = new Map();
		for (const row of rows) if (matches(row)) byId.set(row.id, row);
		const accounted = new Set();
		const list = workspaces.items.map((workspace) => {
			const sessions = workspace.sessionIds
				.map((id) => {
					accounted.add(id);
					return byId.get(id);
				})
				.filter((row) => row !== undefined);
			const label = workspace.title !== undefined && workspace.title !== '' ? workspace.title : workspace.path;
			return { key: workspace.workspaceId, label, sessions };
		});
		const rest = rows.filter((row) => byId.has(row.id) && !accounted.has(row.id));
		if (rest.length > 0) list.push({ key: '', label: t('groupUngrouped'), sessions: rest });
		return needle === '' ? list : list.filter((group) => group.sessions.length > 0);
	}, [rows, matches, needle, t, workspaces.items]);

	const visibleRows = React.useMemo(() => groups.flatMap((group) => group.sessions), [groups]);
	const selectable = React.useMemo(() => visibleRows.filter((row) => !row.running), [visibleRows]);
	const visibleIds = React.useMemo(() => new Set(selectable.map((row) => row.id)), [selectable]);
	const selectedIds = selected.filter((id) => visibleIds.has(id));
	const allSelected = selectable.length > 0 && selectedIds.length === selectable.length;
	const expandedKeys = groups.filter((group) => !collapsed.includes(group.key)).map((group) => group.key);

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
		if (typeof props.startSession !== 'function' || group.key === '') return;
		props.startSession(group.key);
	};

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
			{ className: 'sa-btn', type: 'button', onClick: toggleAll, disabled: selectable.length === 0 || busy },
			allSelected ? t('clear') : t('selectAll'),
		),
		h('span', { className: 'sa-count' }, t('selectedCount', { count: selectedIds.length })),
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

	const workspaceDialog =
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
						h(
							'div',
							{ className: 'sa-dialog-title' },
							dialog.kind === 'rename' ? t('renameWorkspaceTitle') : t('deleteWorkspaceTitle'),
						),
						dialog.kind === 'rename'
							? h('input', {
									className: 'sa-search',
									type: 'text',
									autoFocus: true,
									value: dialog.value,
									'aria-label': t('renameWorkspaceTitle'),
									onChange: (event) => setDialog({ ...dialog, value: event.target.value }),
									onKeyDown: (event) => {
										if (event.key === 'Enter') void renameWorkspace(dialog);
										if (event.key === 'Escape') setDialog(null);
									},
								})
							: h('p', { className: 'sa-dialog-body' }, t('deleteWorkspaceBody', { name: dialog.label })),
						h(
							'div',
							{ className: 'sa-dialog-actions' },
							h('button', { className: 'sa-btn', type: 'button', onClick: () => setDialog(null) }, t('cancel')),
							h(
								'button',
								{
									className: dialog.kind === 'rename' ? 'sa-btn sa-btn-primary' : 'sa-btn sa-btn-danger-solid',
									type: 'button',
									onClick: () => {
										if (dialog.kind === 'rename') void renameWorkspace(dialog);
										else void deleteWorkspace(dialog);
									},
								},
								dialog.kind === 'rename' ? t('save') : t('confirmDelete'),
							),
						),
					),
				);

	const noticeLine =
		notice === null
			? null
			: h('p', { className: notice.kind === 'error' ? 'sa-notice sa-notice-error' : 'sa-notice sa-notice-ok' }, notice.text);

	let body;
	if (rows.length === 0) {
		body = h('div', { className: 'sa-empty' }, t('empty'));
	} else if (visibleRows.length === 0) {
		body = h('div', { className: 'sa-empty' }, t('noMatch'));
	} else {
		body = h(SessionTree, {
			variant: 'panel',
			groups,
			expanded: expandedKeys,
			selection: selectedIds,
			busy,
			onOpen: openSession,
			onToggle: toggleGroup,
			onSelectionChange: toggle,
			onDelete: (row) => setConfirming([row.id]),
			onNewSession: startSession,
			onRenameWorkspace: (group) =>
				setDialog({ kind: 'rename', workspaceId: group.key, label: group.label, value: group.label }),
			onDeleteWorkspace: (group) => setDialog({ kind: 'delete', workspaceId: group.key, label: group.label }),
			t,
		});
	}

	return h(
		'div',
		{ className: 'sa-root' },
		h('style', null, CSS),
		header,
		h(SidebarSwitch, { t }),
		toolbar,
		confirmBar,
		noticeLine,
		body,
		workspaceDialog,
		h('p', { className: 'sa-hint' }, t('hint')),
	);
}
