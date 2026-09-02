import type { Runtime } from '../../core';
import type { CubeConfig } from '../../core';
import type { CommandPalette } from './command-palette';
import { renderDock } from './dock';
import { renderSidebar } from './sidebar';
import type { WindowManager } from '../windows/window-manager';
import type { WorkspaceStateStore } from '../state/workspace-state';
import type { WorkspaceSystemState } from '../types';
import type { WorkspaceManager } from '../workspaces/workspace-manager';

export interface WorkspaceShellDependencies {
  commandPalette: CommandPalette;
  runtime: Runtime;
  stateStore: WorkspaceStateStore;
  windowManager: WindowManager;
  workspaceManager: WorkspaceManager;
}

/**
 * Renders the Phase 2 workspace shell.
 */
export const renderWorkspaceShell = (
  container: HTMLElement,
  config: Readonly<CubeConfig>,
  dependencies: WorkspaceShellDependencies,
): (() => void) => {
  container.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'cube-shell';

  const sidebar = document.createElement('aside');
  const main = document.createElement('section');
  main.className = 'cube-shell__main';

  const toolbar = document.createElement('header');
  toolbar.className = 'cube-toolbar';

  const title = document.createElement('div');
  title.className = 'cube-toolbar__title';

  const titleHeading = document.createElement('h1');
  titleHeading.textContent = config.workspace.title;

  const subtitle = document.createElement('p');
  subtitle.textContent = config.workspace.description;

  title.append(titleHeading, subtitle);

  const actions = document.createElement('div');
  actions.className = 'cube-toolbar__actions';

  const newWorkspaceButton = document.createElement('button');
  newWorkspaceButton.type = 'button';
  newWorkspaceButton.textContent = 'New Workspace';
  newWorkspaceButton.addEventListener('click', () => {
    dependencies.workspaceManager.createWorkspace({
      activate: true,
    });
  });

  const newWindowButton = document.createElement('button');
  newWindowButton.type = 'button';
  newWindowButton.textContent = 'Open Window';
  newWindowButton.addEventListener('click', () => {
    dependencies.windowManager.createWindow();
  });

  const commandButton = document.createElement('button');
  commandButton.type = 'button';
  commandButton.textContent = 'Command Palette';
  commandButton.addEventListener('click', () => {
    dependencies.commandPalette.toggle();
  });

  actions.append(newWorkspaceButton, newWindowButton, commandButton);
  toolbar.append(title, actions);

  const viewport = document.createElement('div');
  viewport.className = 'cube-viewport';

  const dock = document.createElement('footer');

  main.append(toolbar, viewport, dock);
  shell.append(sidebar, main, dependencies.commandPalette.getElement());
  container.append(shell);

  const renderState = (state: Readonly<WorkspaceSystemState>): void => {
    renderSidebar({
      container: sidebar,
      state,
      workspaceManager: dependencies.workspaceManager,
    });
    renderDock({
      container: dock,
      state,
      windowManager: dependencies.windowManager,
    });
    renderViewport({
      config,
      container: viewport,
      runtime: dependencies.runtime,
      state,
      windowManager: dependencies.windowManager,
      workspaceManager: dependencies.workspaceManager,
    });
  };

  renderState(dependencies.stateStore.getState());
  const unsubscribe = dependencies.stateStore.subscribe(renderState);

  return () => {
    unsubscribe();
    dependencies.commandPalette.destroy();
  };
};

interface ViewportRenderContext {
  config: Readonly<CubeConfig>;
  container: HTMLElement;
  runtime: Runtime;
  state: Readonly<WorkspaceSystemState>;
  windowManager: WindowManager;
  workspaceManager: WorkspaceManager;
}

const renderViewport = ({
  config,
  container,
  runtime,
  state,
  windowManager,
  workspaceManager,
}: ViewportRenderContext): void => {
  container.innerHTML = '';

  const activeWorkspace = state.workspaces.find(
    (workspace) => workspace.id === state.activeWorkspaceId,
  );

  const status = document.createElement('div');
  status.className = 'cube-viewport__status';
  status.textContent = `Runtime: ${runtime.getStatus()}`;
  container.append(status);

  if (!activeWorkspace) {
    const emptyState = document.createElement('div');
    emptyState.className = 'cube-viewport__empty';

    const message = document.createElement('p');
    message.textContent = 'No workspace is open yet.';

    const createButton = document.createElement('button');
    createButton.type = 'button';
    createButton.textContent = 'Create Workspace';
    createButton.addEventListener('click', () => {
      workspaceManager.createWorkspace({
        activate: true,
      });
    });

    emptyState.append(message, createButton);
    container.append(emptyState);
    return;
  }

  const workspaceHeader = document.createElement('div');
  workspaceHeader.className = 'cube-viewport__header';

  const workspaceTitle = document.createElement('h2');
  workspaceTitle.textContent = activeWorkspace.name;

  const workspaceSubtitle = document.createElement('p');
  workspaceSubtitle.textContent = config.workspace.description;

  workspaceHeader.append(workspaceTitle, workspaceSubtitle);
  container.append(workspaceHeader);

  const windowSurface = document.createElement('div');
  windowSurface.className = 'cube-window-surface';

  const visibleWindows = state.windows
    .filter(
      (window) =>
        window.workspaceId === activeWorkspace.id && window.mode !== 'minimized',
    )
    .sort((left, right) => left.zIndex - right.zIndex);

  for (const window of visibleWindows) {
    const windowElement = document.createElement('article');
    windowElement.className = 'cube-window';
    windowElement.style.left = `${window.layout.bounds.x}px`;
    windowElement.style.top = `${window.layout.bounds.y}px`;
    windowElement.style.width = `${window.layout.bounds.width}px`;
    windowElement.style.height = `${window.layout.bounds.height}px`;
    windowElement.style.zIndex = String(window.zIndex);

    if (window.isFocused) {
      windowElement.setAttribute('data-focused', 'true');
    }

    const header = document.createElement('header');
    header.className = 'cube-window__header';
    header.addEventListener('mousedown', () => {
      windowManager.focusWindow(window.id);
    });

    const title = document.createElement('span');
    title.textContent = window.title;

    const controls = document.createElement('div');
    controls.className = 'cube-window__controls';

    const minimizeButton = document.createElement('button');
    minimizeButton.type = 'button';
    minimizeButton.textContent = 'Min';
    minimizeButton.addEventListener('click', () => {
      windowManager.minimizeWindow(window.id);
    });

    const maximizeButton = document.createElement('button');
    maximizeButton.type = 'button';
    maximizeButton.textContent =
      window.mode === 'maximized' ? 'Restore' : 'Max';
    maximizeButton.addEventListener('click', () => {
      if (window.mode === 'maximized') {
        windowManager.restoreWindow(window.id);
        return;
      }

      windowManager.maximizeWindow(window.id);
    });

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', () => {
      windowManager.closeWindow(window.id);
    });

    controls.append(minimizeButton, maximizeButton, closeButton);
    header.append(title, controls);

    const body = document.createElement('div');
    body.className = 'cube-window__body';
    body.textContent =
      'Generic workspace window. Application content will arrive in later phases.';

    windowElement.append(header, body);
    windowSurface.append(windowElement);
  }

  container.append(windowSurface);
};
