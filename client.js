window.__ModuleLoader__.load({
	id: '@local/dsh-session-admin',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		const NS = 'sessionAdmin';
		const DELETE_URL = '/plugins/session-admin/delete';

		const zh = {
			nav: '会话管理',
			title: '会话管理',
			desc: '列出已保存的会话（不含归档），勾选后批量删除。删除会移除会话文件，不可恢复；正在运行的会话会被跳过。',
			search: '搜索标题或目录',
			selectAll: '全选',
			clear: '清空',
			selectedCount: '已选 {count} 个',
			delete: '删除',
			deleteSession: '删除会话',
			confirmTitle: '确认删除 {count} 个会话？',
			confirmOneTitle: '删除会话「{title}」？',
			confirmBody: '删除后无法恢复。侧栏列表要重启 dsh 才会刷新，本页立即生效。',
			confirmOneBody: '会话文件会被删除，不可恢复。侧栏要重启 dsh 后才不再显示。',
			cancel: '取消',
			confirmDelete: '确认删除',
			running: '运行中',
			runningHint: '会话正在运行，先停止再删',
			subagent: '子会话',
			blank: '空会话',
			noProject: '无目录',
			empty: '没有可管理的会话。',
			noMatch: '没有匹配的会话。',
			unnamed: '未命名',
			noticeDeleted: '已删除 {count} 个会话。',
			noticeSkipped: '跳过 {count} 个：{reasons}',
			noticeFailed: '删除失败：{message}',
			hint: '删除只清理会话文件与投影缓存；侧栏由 Host 启动时建立的索引驱动，重启 dsharness.service 后才会彻底消失。',
		};

		const en = {
			nav: 'Sessions',
			title: 'Session management',
			desc: 'List stored Sessions (archived ones excluded) and delete them in bulk. Deleting removes the session files and cannot be undone; a running Session is skipped.',
			search: 'Search title or directory',
			selectAll: 'Select all',
			clear: 'Clear',
			selectedCount: '{count} selected',
			delete: 'Delete',
			deleteSession: 'Delete session',
			confirmTitle: 'Delete {count} sessions?',
			confirmOneTitle: 'Delete “{title}”?',
			confirmBody: 'This cannot be undone. The sidebar refreshes after a dsh restart; this page updates immediately.',
			confirmOneBody: 'The session files are removed for good. The sidebar keeps the row until dsh restarts.',
			cancel: 'Cancel',
			confirmDelete: 'Delete permanently',
			running: 'Running',
			runningHint: 'This session is running; stop it first.',
			subagent: 'Subagent',
			blank: 'Empty',
			noProject: 'No directory',
			empty: 'No sessions to manage.',
			noMatch: 'No matching sessions.',
			unnamed: 'Untitled',
			noticeDeleted: 'Deleted {count} sessions.',
			noticeSkipped: 'Skipped {count}: {reasons}',
			noticeFailed: 'Delete failed: {message}',
			hint: 'Deleting removes session files and the projection checkpoint; the sidebar is driven by an index built at host startup, so it clears only after restarting dsharness.service.',
		};

		const CSS = `
.sa-root { width: 100%; max-width: 760px; display: flex; flex-direction: column; gap: 14px; color: var(--dsw-alias-label-primary); }
.sa-head h2 { margin: 0 0 4px; font-size: 15px; line-height: 22px; font-weight: 600; }
.sa-desc { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.sa-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sa-search { flex: 1 1 220px; min-width: 160px; height: 30px; padding: 0 10px; border-radius: 6px; border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1); color: inherit; font: inherit; font-size: 13px; }
.sa-search::placeholder { color: var(--dsw-alias-label-secondary); }
.sa-btn { height: 30px; padding: 0 12px; border-radius: 6px; border: 0.5px solid var(--dsw-alias-border-l2); background: transparent; color: inherit; font: inherit; font-size: 13px; line-height: 28px; cursor: pointer; }
.sa-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.sa-btn:disabled { opacity: 0.45; cursor: default; }
.sa-btn-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.sa-btn-danger:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2); }
.sa-btn-danger-solid { border-color: transparent; background: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-bg-base); }
.sa-btn-danger-solid:hover:not(:disabled) { background: var(--dsw-alias-state-error-primary); opacity: 0.9; }
.sa-count { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.sa-list { border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; overflow: hidden; }
.sa-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-top: 0.5px solid var(--dsw-alias-border-l1); }
.sa-row:first-child { border-top: none; }
.sa-row:hover { background: var(--dsw-alias-bg-layer-1); }
.sa-check { margin: 2px 0 0; flex: none; }
.sa-main { flex: 1; min-width: 0; }
.sa-title { display: flex; align-items: center; gap: 6px; font-size: 13px; line-height: 18px; min-width: 0; }
.sa-title-text { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sa-meta { margin-top: 2px; font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sa-tag { flex: none; font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); }
.sa-tag-running { color: var(--dsw-alias-state-warn-primary); }
.sa-empty { padding: 24px 12px; text-align: center; font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.sa-confirm { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 12px; border-radius: 8px; border: 0.5px solid var(--dsw-alias-state-error-primary); font-size: 13px; line-height: 18px; }
.sa-confirm-text { flex: 1 1 220px; min-width: 0; }
.sa-confirm-body { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 16px; }
.sa-notice { font-size: 13px; line-height: 18px; }
.sa-notice-ok { color: var(--dsw-alias-state-success-primary); }
.sa-notice-error { color: var(--dsw-alias-state-error-primary); }
.sa-hint { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary); }
.sa-itemWrap { position: relative; }
.sa-item { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; padding: 6px 8px; border: none; border-radius: var(--dsw-radius-md); background: transparent; cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); text-align: left; }
.sa-item:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.sa-item:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); outline: none; }
.sa-item:disabled { opacity: 0.4; cursor: not-allowed; }
.sa-itemIcon { display: inline-flex; flex: none; width: 14px; height: 14px; align-items: center; justify-content: center; color: var(--dsw-alias-menu-icon); }
.sa-itemIcon svg { width: 14px; height: 14px; }
.sa-itemLabel { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-item-danger, .sa-item-danger .sa-itemIcon { color: var(--dsw-alias-state-error-primary); }
.sa-item-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
.sa-item-danger:focus-visible:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); outline: none; }
.sa-mask { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; background: var(--dsw-alias-bg-mask-1); backdrop-filter: var(--dsw-mask-blur); }
.sa-dialog { width: 380px; max-width: calc(100vw - 48px); padding: 20px; display: flex; flex-direction: column; gap: 10px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-2); box-shadow: var(--dsw-elevation-prominent); color: var(--dsw-alias-label-primary); }
.sa-dialog-title { font-size: 15px; line-height: 22px; font-weight: 600; }
.sa-dialog-body { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.sa-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.sa-toast { position: fixed; left: 50%; bottom: 28px; z-index: 1200; transform: translateX(-50%); padding: 8px 14px; max-width: min(560px, calc(100vw - 48px)); border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-overlay); box-shadow: var(--dsw-elevation-prominent); font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
.sa-toast-error { color: var(--dsw-alias-state-error-primary); }
`;

		/**
		 * Format one epoch-millisecond value for a row.
		 * @param value - timestamp in milliseconds.
		 * @returns a short local date-time.
		 */
		function formatTime(value) {
			if (!Number.isFinite(value)) return '';
			const date = new Date(value);
			const pad = (part) => String(part).padStart(2, '0');
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}

		/**
		 * Keep first occurrences in order.
		 * @param values - values with possible duplicates.
		 * @returns deduplicated values.
		 */
		function orderedUnique(values) {
			const seen = new Set();
			const result = [];
			for (const value of values) {
				if (seen.has(value)) continue;
				seen.add(value);
				result.push(value);
			}
			return result;
		}

		/**
		 * Ask the Host to delete Sessions. The settings page and the row menu
		 * share this one call.
		 * @param ids - session ids to delete.
		 * @returns the Host result, or one failure message.
		 */
		async function postDelete(ids) {
			try {
				const response = await fetch(DELETE_URL, {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ ids }),
				});
				const data = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
				if (data.ok !== true) return { ok: false, error: data.error ?? `HTTP ${response.status}` };
				return {
					ok: true,
					deleted: Array.isArray(data.deleted) ? data.deleted : [],
					skipped: Array.isArray(data.skipped) ? data.skipped : [],
				};
			} catch (error) {
				return { ok: false, error: error instanceof Error ? error.message : String(error) };
			}
		}

		/** Ids this browser has already deleted; the catalog keeps them until it reloads. */
		let vanished = [];
		const vanishedListeners = new Set();

		/**
		 * Publish deleted ids to every mounted surface.
		 * @param ids - ids the Host confirmed as deleted.
		 */
		function markVanished(ids) {
			if (ids.length === 0) return;
			vanished = orderedUnique([...vanished, ...ids]);
			for (const listener of vanishedListeners) listener();
		}

		/**
		 * Subscribe one component to the deleted-id list.
		 * @returns the current deleted ids.
		 */
		function useVanished() {
			const [value, setValue] = React.useState(vanished);
			React.useEffect(() => {
				const listener = () => setValue(vanished);
				vanishedListeners.add(listener);
				return () => {
					vanishedListeners.delete(listener);
				};
			}, []);
			return value;
		}

		/** Overlay state: one confirm request or one transient notice. */
		let overlay = null;
		const overlayListeners = new Set();

		/**
		 * Replace the overlay state.
		 * @param next - confirm request, a notice, or null to close.
		 */
		function setOverlay(next) {
			overlay = next;
			for (const listener of overlayListeners) listener();
		}

		/**
		 * Subscribe one component to the overlay state.
		 * @returns the current overlay state.
		 */
		function useOverlay() {
			const [value, setValue] = React.useState(overlay);
			React.useEffect(() => {
				const listener = () => setValue(overlay);
				overlayListeners.add(listener);
				return () => {
					overlayListeners.delete(listener);
				};
			}, []);
			return value;
		}

		/**
		 * Session management page: browse the live client catalog, select, delete.
		 * @param props - slot props: locale seat, session catalog, workspace snapshot.
		 * @returns the settings section element.
		 */
		function SessionAdminSection(props) {
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
				toolbar,
				confirmBar,
				noticeLine,
				body,
				h('p', { className: 'sa-hint' }, t('hint')),
			);
		}

		/** 16×16 outline trash glyph matching the shipped menu icon weight. */
		const TRASH_ICON = h(
			'svg',
			{
				viewBox: '0 0 16 16',
				width: 14,
				height: 14,
				fill: 'none',
				xmlns: 'http://www.w3.org/2000/svg',
				'aria-hidden': 'true',
				strokeWidth: 1,
			},
			h('path', { d: 'M2.75 4.25h10.5', stroke: 'currentColor', strokeLinecap: 'round' }),
			h('path', {
				d: 'M6.25 4.25V3.3c0-.44.36-.8.8-.8h1.9c.44 0 .8.36.8.8v.95',
				stroke: 'currentColor',
				strokeLinecap: 'round',
			}),
			h('path', {
				d: 'M4.1 4.25l.55 8.3c.03.55.49.97 1.04.97h4.62c.55 0 1.01-.42 1.04-.97l.55-8.3',
				stroke: 'currentColor',
				strokeLinejoin: 'round',
			}),
			h('path', { d: 'M6.75 7v4.2M9.25 7v4.2', stroke: 'currentColor', strokeLinecap: 'round' }),
		);

		/**
		 * One row of a Session's "..." menu; asks the overlay for confirmation.
		 * @param props - row identity, menu open state, session catalog, locale seat.
		 * @returns the menu row.
		 */
		function SessionDeleteMenuItem(props) {
			const t = props.t;
			const [, setMenuOpen] = props.useMenuOpenState();
			const running = props.useSessions((state) => state.byId[props.sessionId]?.running === true);
			const title = props.displayTitle === '' ? t('unnamed') : props.displayTitle;
			return h(
				'div',
				{ className: 'sa-itemWrap' },
				h('style', null, CSS),
				h(
					'button',
					{
						type: 'button',
						role: 'menuitem',
						className: 'sa-item sa-item-danger',
						disabled: running,
						title: running ? t('runningHint') : undefined,
						onClick: () => {
							setMenuOpen(false);
							setOverlay({ kind: 'confirm', sessionId: props.sessionId, title });
						},
					},
					h('span', { className: 'sa-itemIcon' }, TRASH_ICON),
					h('span', { className: 'sa-itemLabel' }, t('deleteSession')),
				),
			);
		}

		/**
		 * Frame-wide overlay: the one-Session confirmation and its result notice.
		 * @param props - locale seat.
		 * @returns the dialog or toast, or null.
		 */
		function SessionAdminOverlay(props) {
			const t = props.t;
			const state = useOverlay();
			const [busy, setBusy] = React.useState(false);

			React.useEffect(() => {
				if (state === null || state.kind !== 'notice') return undefined;
				const timer = setTimeout(() => setOverlay(null), 3200);
				return () => clearTimeout(timer);
			}, [state]);

			React.useEffect(() => {
				if (state === null) return undefined;
				const onKey = (event) => {
					if (event.key === 'Escape' && !busy) setOverlay(null);
				};
				window.addEventListener('keydown', onKey);
				return () => window.removeEventListener('keydown', onKey);
			}, [state, busy]);

			if (state === null) return null;

			if (state.kind === 'notice') {
				return h('div', { className: state.tone === 'error' ? 'sa-toast sa-toast-error' : 'sa-toast', role: 'status' }, state.text);
			}

			const confirm = async () => {
				setBusy(true);
				const result = await postDelete([state.sessionId]);
				setBusy(false);
				if (!result.ok) {
					setOverlay({ kind: 'notice', tone: 'error', text: t('noticeFailed', { message: result.error }) });
					return;
				}
				markVanished(result.deleted);
				const reasons = result.skipped.map((row) => row.reason).join('；');
				setOverlay({
					kind: 'notice',
					tone: result.deleted.length === 0 ? 'error' : 'ok',
					text:
						result.skipped.length === 0
							? t('noticeDeleted', { count: result.deleted.length })
							: `${t('noticeDeleted', { count: result.deleted.length })} ${t('noticeSkipped', { count: result.skipped.length, reasons })}`,
				});
			};

			return h(
				'div',
				{ className: 'sa-mask' },
				h('style', null, CSS),
				h(
					'div',
					{ className: 'sa-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('deleteSession') },
					h('div', { className: 'sa-dialog-title' }, t('confirmOneTitle', { title: state.title })),
					h('div', { className: 'sa-dialog-body' }, t('confirmOneBody')),
					h(
						'div',
						{ className: 'sa-dialog-actions' },
						h('button', { className: 'sa-btn', type: 'button', disabled: busy, autoFocus: true, onClick: () => setOverlay(null) }, t('cancel')),
						h('button', { className: 'sa-btn sa-btn-danger-solid', type: 'button', disabled: busy, onClick: () => void confirm() }, t('confirmDelete')),
					),
				),
			);
		}

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-admin: dictionaries');
			const t = ctx.locale.bind(NS);

			ctx.slots.inject('settings.section', () =>
				ctx.slots.register(
					{
						name: 'settings.section',
						id: 'session-admin',
						order: 30,
						label: () => t('nav'),
						locale: NS,
					},
					SessionAdminSection,
				),
			);

			ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
				ctx.slots.register(
					{
						name: 'sidebar.workspaces.session.menu.item',
						id: 'session-admin-delete',
						order: 500,
						locale: NS,
					},
					SessionDeleteMenuItem,
				),
			);

			ctx.slots.inject('shell.overlay', () =>
				ctx.slots.register(
					{
						name: 'shell.overlay',
						id: 'session-admin-overlay',
						order: 900,
						locale: NS,
					},
					SessionAdminOverlay,
				),
			);
		}

		return {
			inject: ['slots', 'locale'],
			apply,
		};
	},
});
