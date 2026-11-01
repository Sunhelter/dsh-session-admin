/**
 * Frame-wide overlay: the one-Session confirmation dialog and its result
 * toast. Mounted by the `shell.overlay` seat.
 */
import React, { h } from '../react.js';
import { postDelete } from '../api.js';
import { setOverlay, useOverlay } from '../stores/overlay.js';
import { markVanished } from '../stores/vanished.js';

/** How long a result toast stays up, in milliseconds. */
const TOAST_MS = 3200;

/**
 * @param props - locale seat.
 * @returns the dialog or toast, or null.
 */
export function SessionAdminOverlay(props) {
	const t = props.t;
	const state = useOverlay();
	const [busy, setBusy] = React.useState(false);

	React.useEffect(() => {
		if (state === null || state.kind !== 'notice') return undefined;
		const timer = setTimeout(() => setOverlay(null), TOAST_MS);
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
