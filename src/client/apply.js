/**
 * Seat registrations. Each `inject` waits for its declared slot and keeps the
 * registration inside the caller's fiber, so plugin unload removes it.
 */
import { h } from './react.js';
import { NS, en, zh } from './i18n.js';
import { SessionAdminSection } from './components/section.js';
import { SessionDeleteMenuItem } from './components/menu-item.js';
import { SessionAdminOverlay } from './components/overlay.js';
import { SidebarWorkspaces } from './components/sidebar-workspaces.js';
import { installLogoToggle } from './logo-toggle.js';
import { installSettingsNavIcon } from './nav-icon.js';
import { bindAutomation } from './stores/automation.js';
import { getShellOverride, subscribeShell } from './stores/shell.js';
import { CSS } from './styles.js';

/**
 * Register the plugin's client surfaces on one browser context.
 * @param ctx - client context carrying the slot registry and locale service.
 */
export function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-admin: dictionaries');

	// The tree styles live in one stylesheet for the whole document: the sidebar
	// renders before the settings page is ever opened.
	ctx.effect(() => {
		const style = document.createElement('style');
		style.dataset.plugin = 'session-admin';
		style.dataset.pluginCss = 'session-admin/tree';
		style.textContent = CSS;
		document.head.appendChild(style);
		return () => {
			style.remove();
		};
	}, 'session-admin: styles');
	const t = ctx.locale.bind(NS);
	installSettingsNavIcon(ctx, () => t('nav'));
	installLogoToggle(ctx, () => ({
		toSessionList: t('toSessionList'),
		toNativeSidebar: t('toNativeSidebar'),
	}));
	bindAutomation(ctx);

	/** Archive one Session; a running one is refused by the host. */
	const archiveSession = (id, options) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null) return Promise.resolve();
		return Promise.resolve(workspace.archiveSession(id, options));
	};

	const unarchiveSession = (id) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null) return Promise.resolve();
		return Promise.resolve(workspace.unarchiveSession(id));
	};

	/**
	 * Pin a Session natively too, so the shipped sidebar and our card list agree
	 * on what is pinned; our own list lives in `localStorage`.
	 * @param id - Session id.
	 */
	const pinSession = (id) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null) return Promise.resolve();
		if (typeof workspace.pinSession !== 'function') return Promise.resolve();
		return Promise.resolve(workspace.pinSession(id)).catch(() => {});
	};

	/**
	 * Clear a Session's native pin as well.
	 * @param id - Session id.
	 */
	const unpinSession = (id) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null) return Promise.resolve();
		if (typeof workspace.unpinSession !== 'function') return Promise.resolve();
		return Promise.resolve(workspace.unpinSession(id)).catch(() => {});
	};

	const openSession = (id) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null) return;
		void Promise.resolve(workspace.openSession(id)).catch(() => {});
	};

	/** Rename one Session; the host normalizes the title before storing it. */
	const renameSession = (sessionId, title) => {
		const sessions = ctx.get('sessions');
		const manager = sessions?.manager;
		if (manager === undefined || manager === null || typeof manager.rename !== 'function') {
			return Promise.resolve(undefined);
		}
		return manager.rename(sessionId, title);
	};

	/** List one directory level for the in-app picker (browse backends only). */
	const listDirectory = (path) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null || typeof workspace.listDirectory !== 'function') {
			return Promise.reject(new Error('directory browsing is unavailable'));
		}
		return workspace.listDirectory(path);
	};

	/** Adopt an existing directory as a Workspace; the controller merges it into the snapshot. */
	const createWorkspace = (path) => {
		const workspaces = ctx.get('workspaces');
		if (workspaces === undefined || workspaces === null || typeof workspaces.create !== 'function') {
			return Promise.resolve(undefined);
		}
		return workspaces.create({ path });
	};

	ctx.slots.inject('settings.section', () =>
		ctx.slots.register(
			{
				name: 'settings.section',
				id: 'session-admin',
				order: 30,
				label: () => t('nav'),
				locale: NS,
			},
			(slotProps) =>
				h(SessionAdminSection, {
					...slotProps,
					openSession,
					archiveSession,
					unarchiveSession,
					pinSession,
					unpinSession,
					renameSession,
				}),
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

	/**
	 * Shadow the shipped workspace browser while the preference is on, and step
	 * aside the moment it turns off. `priority: -1` outranks ui-workspace's own
	 * entry; the sidebar shell keeps its brand row, new-session button, footer and
	 * settings seats, so nothing has to be re-declared here.
	 *
	 * `sidebar` is a single seat: same-priority duplicate registrations throw, and
	 * only static boot plugins pick their own priority (dynamic packages get one
	 * assigned). The shell cannot be re-declared either — `renderSlot` is only
	 * passed to registrations that declare `children`, and ui-sidebar already
	 * declared the eight sidebar children, so a second declaration would fail.
	 */
	let disposeSidebar;
	const syncSidebar = () => {
		const enabled = getShellOverride();
		if (enabled && disposeSidebar === undefined) {
			disposeSidebar = ctx.slots.inject('sidebar.workspaces', () =>
				ctx.slots.register(
					{
						name: 'sidebar.workspaces',
						locale: NS,
						priority: -1,
					},
					(slotProps) =>
						h(SidebarWorkspaces, {
							...slotProps,
							openSession,
							pinSession,
							unpinSession,
							renameSession,
							archiveSession,
							unarchiveSession,
							createWorkspace,
							listDirectory,
						}),
				),
			);
			return;
		}
		if (!enabled && disposeSidebar !== undefined) {
			disposeSidebar();
			disposeSidebar = undefined;
		}
	};

	ctx.effect(() => {
		const unsubscribe = subscribeShell(syncSidebar);
		syncSidebar();
		return () => {
			unsubscribe();
			if (disposeSidebar !== undefined) {
				disposeSidebar();
				disposeSidebar = undefined;
			}
		};
	}, 'session-admin: sidebar override');
}
