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
import { installSettingsNavIcon } from './nav-icon.js';
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
	 * Pin a Session natively too, so the shipped sidebar and our tree agree on
	 * what is pinned; our own order still lives in `layout.json`.
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

	/** Create a blank Session inside one Workspace; the workspace service may load after this plugin. */
	const startSession = (workspaceId) => {
		const workspace = ctx.get('uiWorkspace');
		if (workspace === undefined || workspace === null) return;
		void Promise.resolve(workspace.startSession(workspaceId, { clearPreviousDraft: false })).catch(() => {});
	};

	/** Rename one Workspace through the workspace controller service. */
	const renameWorkspace = (workspaceId, title) => {
		const workspaces = ctx.get('workspaces');
		if (workspaces === undefined || workspaces === null) return Promise.resolve();
		return workspaces.rename(workspaceId, title);
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

	/** Delete one Workspace; its Sessions fall back to the ungrouped bucket. */
	const deleteWorkspace = (workspaceId) => {
		const workspaces = ctx.get('workspaces');
		if (workspaces === undefined || workspaces === null) return Promise.resolve();
		return workspaces.delete(workspaceId);
	};

	/**
	 * Push the tree's folder order back to the native Workspace order, so the
	 * shipped sidebar lists Workspaces the same way. Appending in sequence
	 * leaves them in the given order.
	 * @param ids - Workspace ids in display order.
	 */
	const syncWorkspaceOrder = async (ids) => {
		const workspaces = ctx.get('workspaces');
		if (workspaces === undefined || workspaces === null || typeof workspaces.insertBefore !== 'function') return;
		for (const id of ids) await workspaces.insertBefore(id, undefined);
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
					startSession,
					renameWorkspace,
					deleteWorkspace,
					archiveSession,
					unarchiveSession,
					syncWorkspaceOrder,
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
							startSession,
							syncWorkspaceOrder,
							pinSession,
							unpinSession,
							renameSession,
							archiveSession,
							unarchiveSession,
							renameWorkspace,
							deleteWorkspace,
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
