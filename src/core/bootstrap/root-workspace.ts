import type { CubeConfig } from '../config/default-config';
import type { Runtime } from '../runtime/runtime';
import type { WorkspaceSystem } from '../../workspace';
import { renderWorkspaceShell } from '../../workspace';

/**
 * Renders the root workspace shell for the active Cube runtime.
 */
export const renderRootWorkspace = (
  container: HTMLElement,
  config: Readonly<CubeConfig>,
  runtime: Runtime,
  workspace: WorkspaceSystem,
): void => {
  renderWorkspaceShell(container, config, {
    commandPalette: workspace.commandPalette,
    runtime,
    stateStore: workspace.stateStore,
    windowManager: workspace.windowManager,
    workspaceManager: workspace.workspaceManager,
  });
};
