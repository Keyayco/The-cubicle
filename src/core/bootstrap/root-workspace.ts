import type { CubeConfig } from '../config/default-config';
import type { Runtime, RuntimeStatusChange } from '../runtime/runtime';
import type { WorkspaceManager } from '../workspace/workspace-manager';

/**
 * Renders the minimal root workspace required for Phase 1 boot validation.
 */
export const renderRootWorkspace = (
  container: HTMLElement,
  config: Readonly<CubeConfig>,
  runtime: Runtime,
  workspaceManager: WorkspaceManager,
): void => {
  container.innerHTML = '';

  const workspace = document.createElement('main');
  workspace.className = 'cube-root-workspace';

  const header = document.createElement('header');
  header.className = 'cube-root-workspace-header';

  const title = document.createElement('h1');
  title.textContent = config.workspace.title;

  const description = document.createElement('p');
  description.textContent = config.workspace.description;

  const status = document.createElement('p');
  status.className = 'cube-runtime-status';

  const workspaceSummary = document.createElement('p');
  workspaceSummary.className = 'cube-workspace-summary';

  const itemList = document.createElement('nav');
  itemList.className = 'cube-workspace-nav';
  itemList.setAttribute('aria-label', 'Workspace modules');

  const activePanel = document.createElement('section');
  activePanel.className = 'cube-workspace-panel';

  const activeLabel = document.createElement('p');
  activeLabel.className = 'cube-workspace-panel-label';
  activeLabel.textContent = 'Active module';

  const activeTitle = document.createElement('h2');
  const activeDescription = document.createElement('p');
  const activeMeta = document.createElement('p');
  activeMeta.className = 'cube-workspace-panel-meta';

  const syncRuntimeStatus = (value: string): void => {
    workspace.setAttribute('data-runtime-status', value);
    status.textContent = `Runtime status: ${value}`;
  };

  const syncWorkspaceState = (): void => {
    const snapshot = workspaceManager.getSnapshot();
    const activeItem = workspaceManager.getActiveItem();

    workspaceSummary.textContent = `${snapshot.items.length} workspace modules ready.`;
    itemList.innerHTML = '';

    for (const item of snapshot.items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cube-workspace-item';
      button.textContent = item.title;
      button.setAttribute('data-workspace-item-id', item.id);
      button.setAttribute(
        'data-active',
        String(item.id === snapshot.activeItemId),
      );
      button.addEventListener('click', () => {
        void workspaceManager.activateItem(item.id);
      });
      itemList.append(button);
    }

    activeTitle.textContent = activeItem?.title ?? 'Workspace empty';
    activeDescription.textContent =
      activeItem?.description ?? 'No workspace items have been registered yet.';
    activeMeta.textContent = activeItem
      ? `Kind: ${activeItem.kind} | Id: ${activeItem.id}`
      : 'Kind: none';
  };

  syncRuntimeStatus(runtime.getStatus());
  syncWorkspaceState();

  runtime
    .getServices()
    .eventBus.on<RuntimeStatusChange>('runtime:status-changed', (event) => {
      if (!event.payload) {
        return;
      }

      syncRuntimeStatus(event.payload.currentStatus);
    });

  runtime.getServices().eventBus.on('workspace:state-changed', () => {
    syncWorkspaceState();
  });

  header.append(title, description, status, workspaceSummary);
  activePanel.append(activeLabel, activeTitle, activeDescription, activeMeta);
  workspace.append(header, itemList, activePanel);
  container.append(workspace);
};
