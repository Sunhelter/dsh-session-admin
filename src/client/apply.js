/**
 * Seat registrations. Each `inject` waits for its declared slot and keeps the
 * registration inside the caller's fiber, so plugin unload removes it.
 */
import { NS, en, zh } from './i18n.js';
import { SessionAdminSection } from './components/section.js';
import { SessionDeleteMenuItem } from './components/menu-item.js';
import { SessionAdminOverlay } from './components/overlay.js';

/**
 * Register the plugin's client surfaces on one browser context.
 * @param ctx - client context carrying the slot registry and locale service.
 */
export function apply(ctx) {
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
