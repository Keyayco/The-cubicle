import type {
  CommandService,
  EventBus,
  Runtime,
  WorkspaceManager,
  WorkspaceSnapshot,
} from '../core';
import { CubeIndicator } from './cube-indicator';
import { TerminalView } from './terminal';

export interface RootWorkspaceOptions {
  commandService: CommandService;
  eventBus: EventBus;
  runtime: Runtime;
  workspaceManager: WorkspaceManager;
}

/**
 * Mounts the browser shell and returns a disposer for every event subscription.
 */
export const renderRootWorkspace = (
  container: HTMLElement,
  options: RootWorkspaceOptions,
): (() => void) => {
  const shell = document.createElement('main');
  shell.className = 'cubicle-shell';
  shell.setAttribute('aria-label', 'The Cubicle operating environment');

  const header = document.createElement('header');
  header.className = 'cubicle-header';
  const title = document.createElement('p');
  title.className = 'cubicle-wordmark';
  title.textContent = 'THE CUBICLE';
  const subtitle = document.createElement('p');
  subtitle.className = 'cubicle-subtitle';
  subtitle.textContent = 'Plugin-driven operating environment';
  header.append(title, subtitle);

  const cubeContainer = document.createElement('div');
  cubeContainer.className = 'cube-container';

  const workspace = document.createElement('section');
  workspace.className = 'application-workspace';
  workspace.setAttribute('aria-labelledby', 'application-workspace-title');
  const workspaceHeader = document.createElement('div');
  workspaceHeader.className = 'application-workspace-header';
  const workspaceTitle = document.createElement('h2');
  workspaceTitle.id = 'application-workspace-title';
  workspaceTitle.textContent = 'Application workspace';
  const workspaceKind = document.createElement('span');
  workspaceKind.className = 'workspace-kind';
  workspaceHeader.append(workspaceTitle, workspaceKind);
  const workspaceDescription = document.createElement('p');
  workspaceDescription.className = 'workspace-description';
  const workspaceNotice = document.createElement('p');
  workspaceNotice.className = 'workspace-notice';
  workspaceNotice.textContent =
    'Workspace items are metadata only. No application renderer is registered for this item.';
  workspace.append(workspaceHeader, workspaceDescription, workspaceNotice);

  const content = document.createElement('div');
  content.className = 'cubicle-content';
  const terminalContainer = document.createElement('div');
  terminalContainer.className = 'terminal-container';
  content.append(workspace, terminalContainer);
  shell.append(header, cubeContainer, content);
  container.replaceChildren(shell);

  const cube = new CubeIndicator(cubeContainer, options.eventBus, options.runtime);
  const terminal = new TerminalView({
    container: terminalContainer,
    commandService: options.commandService,
    eventBus: options.eventBus,
  });

  const renderWorkspace = (snapshot?: WorkspaceSnapshot): void => {
    const state = snapshot ?? options.workspaceManager.getSnapshot();
    const activeItem = state.items.find(
      (item) => item.id === state.activeItemId,
    );
    workspaceTitle.textContent = activeItem?.title ?? 'Application workspace';
    workspaceDescription.textContent = activeItem
      ? activeItem.description
      : 'No workspace item is active.';
    workspaceKind.textContent = activeItem?.kind ?? 'empty';
    workspace.dataset.activeItemId = activeItem?.id ?? '';
  };

  renderWorkspace();
  const unsubscribeWorkspace = options.eventBus.on<WorkspaceSnapshot>(
    'workspace:state-changed',
    (event) => {
      if (event.payload) {
        renderWorkspace(event.payload);
      }
    },
  );

  let disposed = false;
  return () => {
    if (disposed) {
      return;
    }
    disposed = true;
    unsubscribeWorkspace();
    terminal.dispose();
    cube.dispose();
    if (shell.parentElement === container) {
      container.replaceChildren();
    }
  };
};
