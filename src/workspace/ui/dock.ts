import type { WindowManager } from '../windows/window-manager';
import type { WorkspaceSystemState } from '../types';

export interface DockRenderContext {
  container: HTMLElement;
  state: Readonly<WorkspaceSystemState>;
  windowManager: WindowManager;
}

/**
 * Renders the active workspace dock.
 */
export const renderDock = ({
  container,
  state,
  windowManager,
}: DockRenderContext): void => {
  container.innerHTML = '';
  container.className = 'cube-dock';

  const activeWindows = state.windows.filter(
    (window) => window.workspaceId === state.activeWorkspaceId,
  );

  for (const window of activeWindows) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cube-dock__item';
    button.textContent =
      window.mode === 'minimized'
        ? `${window.title} (Minimized)`
        : window.title;

    button.addEventListener('click', () => {
      if (window.mode === 'minimized') {
        windowManager.restoreWindow(window.id);
        return;
      }

      if (window.isFocused) {
        windowManager.minimizeWindow(window.id);
        return;
      }

      windowManager.focusWindow(window.id);
    });

    container.append(button);
  }
};
