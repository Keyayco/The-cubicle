import type { WorkspaceManager } from '../workspaces/workspace-manager';
import type { WorkspaceSystemState } from '../types';

export interface SidebarRenderContext {
  container: HTMLElement;
  state: Readonly<WorkspaceSystemState>;
  workspaceManager: WorkspaceManager;
}

/**
 * Renders the workspace sidebar.
 */
export const renderSidebar = ({
  container,
  state,
  workspaceManager,
}: SidebarRenderContext): void => {
  container.innerHTML = '';
  container.className = 'cube-sidebar';

  const header = document.createElement('div');
  header.className = 'cube-sidebar__header';

  const title = document.createElement('h2');
  title.textContent = 'Workspaces';

  const createButton = document.createElement('button');
  createButton.type = 'button';
  createButton.textContent = 'New';
  createButton.addEventListener('click', () => {
    workspaceManager.createWorkspace({
      activate: true,
    });
  });

  header.append(title, createButton);

  const list = document.createElement('ul');
  list.className = 'cube-sidebar__list';

  for (const workspace of state.workspaces.filter((item) => item.isOpen)) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cube-sidebar__item';
    button.textContent = workspace.name;

    if (workspace.id === state.activeWorkspaceId) {
      button.setAttribute('aria-current', 'true');
    }

    button.addEventListener('click', () => {
      workspaceManager.switchWorkspace(workspace.id);
    });

    item.append(button);
    list.append(item);
  }

  container.append(header, list);
};
