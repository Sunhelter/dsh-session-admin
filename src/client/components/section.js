/**
 * Session management page: the live client catalog as one flat card list,
 * newest first and cut into day-range buckets. Pinned Sessions sit on top.
 * Mounted by the `settings.section` seat.
 *
 * Pinning only changes where a card is drawn; it never changes the Session's
 * native Workspace membership.
 */
import React, { h } from '../react.js';
import { postDelete } from '../api.js';
import { orderedUnique } from '../format.js';
import { markVanished, useVanished } from '../stores/vanished.js';
import { togglePin, usePinned } from '../stores/pins.js';
import { buildCardList, selectRows } from '../tree-model.js';
import { SessionTree } from './session-tree.js';

/**
 * @param props - slot props: locale seat, session catalog, workspace snapshot,
 *   plus navigation and Session actions (`openSession`, `renameSession`,
 *   `pinSession`, `unpinSession`, `archiveSession`, `unarchiveSession`).
 * @returns the settings section element.
 */
export function SessionAdminSection(props) {
	const t = props.t;
	const catalog = props.useSessions((state) => state);
	const workspaces = props.useWorkspaces((state) => state);
	const archivedIds = workspaces.archivedSessionIds;
	const goneIds = useVanished();
	const pinnedIds = usePinned();

	const [query, setQuery] = React.useState('');
	const [selected, setSelected] = React.useState([]);
	const [confirming, setConfirming] = React.useState(null);
	const [busy, setBusy] = React.useState(false);
	const [notice, setNotice] = React.useState(null);
	const [dialog, setDialog] = React.useState(null);
	const [showArchived, setShowArchived] = React.useState(false);

	const archived = React.useMemo(() => new Set(archivedIds), [archivedIds]);
	const gone = React.useMemo(() => new Set(goneIds), [goneIds]);

	/** Catalog rows worth showing, newest first; blank sessions hidden like the shipped tree. */
	const { rows, currentId } = React.useMemo(
		() => selectRows({ catalog, archivedIds, goneIds, showArchived }),
		[catalog, archivedIds, goneIds, showArchived],
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
			const title = row.title ?? '';
			const cwd = row.cwd ?? '';
			return title.toLowerCase().includes(needle) || cwd.toLowerCase().includes(needle);
		},
		[needle],
	);

	const { pinned, groups, visibleRows, selectable } = buildCardList({
		rows,
		pinnedIds,
		needle,
		matches,
		now: Date.now(),
		t,
	});
	const visibleIds = React.useMemo(() => new Set(selectable.map((row) => row.id)), [selectable]);
	const selectedIds = selected.filter((id) => visibleIds.has(id));
	const allSelected = selectable.length > 0 && selectedIds.length === selectable.length;
	const archivableIds = selectedIds.filter((id) => !archived.has(id) && !gone.has(id));
	const unarchivableIds = selectedIds.filter((id) => archived.has(id) && !gone.has(id));

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

	/**
	 * Pin a Session, and pin it natively too so the shipped sidebar agrees.
	 * @param id - Session id.
	 */
	const pin = (id) => {
		togglePin(id);
		if (typeof props.pinSession === 'function') props.pinSession(id);
	};

	/**
	 * Unpin a Session, clearing the native pin as well.
	 * @param id - Session id.
	 */
	const unpin = (id) => {
		togglePin(id);
		if (typeof props.unpinSession === 'function') props.unpinSession(id);
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

	const submitDialog = () => {
		if (dialog === null) return;
		const value = typeof dialog.value === 'string' ? dialog.value.trim() : '';
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
		if (dialog.kind === 'archive') {
			setDialog(null);
			void archiveRow(dialog.sessionId, true);
			return;
		}
		setDialog(null);
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
		if (dialog.kind === 'renameSession') return t('renameSessionTitle');
		return t('archiveConfirmTitle');
	})();

	const dialogBody = (() => {
		if (dialog === null) return null;
		if (dialog.kind === 'archive') {
			return h('p', { className: 'sa-dialog-body' }, t('archiveConfirmBody', { title: dialog.label }));
		}
		return h('input', {
			className: 'sa-search',
			type: 'text',
			autoFocus: true,
			value: dialog.value ?? '',
			placeholder: t('renameSessionTitle'),
			'aria-label': t('renameSessionTitle'),
			onChange: (event) => setDialog({ ...dialog, value: event.target.value }),
			onKeyDown: (event) => {
				if (event.key === 'Enter') submitDialog();
				if (event.key === 'Escape') setDialog(null);
			},
		});
	})();

	const dialogConfirmLabel = dialog !== null && dialog.kind === 'archive' ? t('archiveConfirmAction') : t('save');

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
							h('button', { className: 'sa-btn sa-btn-primary', type: 'button', onClick: submitDialog }, dialogConfirmLabel),
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
			currentId,

			pinned,
			groups,
			workspaceLabels,
			selection: selectedIds,
			busy,
			archived,
			unread: new Set(),
			automation: new Set(),
			onOpen: openSession,
			onSelectionChange: toggle,
			onDelete: (row) => setConfirming([row.id]),
			onArchive: (id) => void archiveRow(id, false),
			onUnarchive: (id) => void unarchiveRow(id),
			onRename: (row) =>
				setDialog({
					kind: 'renameSession',
					sessionId: row.id,
					value: typeof row.title === 'string' ? row.title : '',
				}),
			onPin: pin,
			onUnpin: unpin,
			t,
		});
	}

	return h(
		'div',
		{ className: 'sa-root' },
		header,
		toolbar,
		confirmBar,
		noticeLine,
		body,
		dialogView,
		h('p', { className: 'sa-hint' }, t('hint')),
	);
}
