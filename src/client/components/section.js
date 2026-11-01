/**
 * Session management page: browse the live client catalog, select, delete.
 * Mounted by the `settings.section` seat.
 */
import React, { h } from '../react.js';
import { postDelete } from '../api.js';
import { formatTime, orderedUnique } from '../format.js';
import { CSS } from '../styles.js';
import { markVanished, useVanished } from '../stores/vanished.js';
import { SidebarSwitch } from './pref-switch.js';

/**
 * @param props - slot props: locale seat, session catalog, workspace snapshot.
 * @returns the settings section element.
 */
export function SessionAdminSection(props) {
	const t = props.t;
	const catalog = props.useSessions((state) => state);
	const archivedIds = props.useWorkspaces((state) => state.archivedSessionIds);
	const goneIds = useVanished();

	const [query, setQuery] = React.useState('');
	const [selected, setSelected] = React.useState([]);
	const [confirming, setConfirming] = React.useState(null);
	const [busy, setBusy] = React.useState(false);
	const [notice, setNotice] = React.useState(null);

	const archived = React.useMemo(() => new Set(archivedIds), [archivedIds]);
	const gone = React.useMemo(() => new Set(goneIds), [goneIds]);

	const rows = React.useMemo(() => {
		const list = [];
		for (const id of catalog.ids) {
			const row = catalog.byId[id];
			if (row === undefined) continue;
			if (archived.has(id) || gone.has(id)) continue;
			list.push(row);
		}
		list.sort((left, right) => right.updatedAt - left.updatedAt);
		return list;
	}, [catalog, archived, gone]);

	const needle = query.trim().toLowerCase();
	const visible = React.useMemo(() => {
		if (needle === '') return rows;
		return rows.filter((row) => {
			const title = row.title ?? '';
			const cwd = row.cwd ?? '';
			return title.toLowerCase().includes(needle) || cwd.toLowerCase().includes(needle);
		});
	}, [rows, needle]);

	const selectable = React.useMemo(() => visible.filter((row) => !row.running), [visible]);
	const visibleIds = React.useMemo(() => new Set(selectable.map((row) => row.id)), [selectable]);
	const selectedIds = selected.filter((id) => visibleIds.has(id));
	const allSelected = selectable.length > 0 && selectedIds.length === selectable.length;

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

	const confirmBar =
		confirming === null
			? null
			: h(
					'div',
					{ className: 'sa-confirm', role: 'alert' },
					h(
						'div',
						{ className: 'sa-confirm-text' },
						h('div', null, t('confirmTitle', { count: confirming.length })),
						h('div', { className: 'sa-confirm-body' }, t('confirmBody')),
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

	const noticeLine =
		notice === null
			? null
			: h('p', { className: notice.kind === 'error' ? 'sa-notice sa-notice-error' : 'sa-notice sa-notice-ok' }, notice.text);

	let body;
	if (rows.length === 0) {
		body = h('div', { className: 'sa-empty' }, t('empty'));
	} else if (visible.length === 0) {
		body = h('div', { className: 'sa-empty' }, t('noMatch'));
	} else {
		body = h(
			'div',
			{ className: 'sa-list' },
			visible.map((row) => {
				const title = row.title !== undefined && row.title.trim() !== '' ? row.title : t('unnamed');
				const where = row.cwd === undefined || row.cwd === '' ? t('noProject') : row.cwd;
				const checked = selectedIds.includes(row.id);
				return h(
					'label',
					{ className: 'sa-row', key: row.id },
					h('input', {
						className: 'sa-check',
						type: 'checkbox',
						checked: checked,
						disabled: row.running || busy,
						onChange: () => toggle(row.id),
					}),
					h(
						'div',
						{ className: 'sa-main' },
						h(
							'div',
							{ className: 'sa-title' },
							h('span', { className: 'sa-title-text' }, title),
							row.running ? h('span', { className: 'sa-tag sa-tag-running' }, t('running')) : null,
							row.blank === true ? h('span', { className: 'sa-tag' }, t('blank')) : null,
							row.origin === 'subagent' ? h('span', { className: 'sa-tag' }, t('subagent')) : null,
						),
						h('div', { className: 'sa-meta' }, `${where} · ${formatTime(row.updatedAt)}`),
					),
				);
			}),
		);
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
		h('p', { className: 'sa-hint' }, t('hint')),
	);
}
