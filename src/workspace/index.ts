export {
  initializeWorkspaceSystem,
  type WorkspaceSystem,
} from './initialize-workspace-system';
export { LayoutManager } from './layout/layout-manager';
export {
  registerWorkspaceCommands,
  WORKSPACE_COMMAND_IDS,
} from './commands/register-workspace-commands';
export {
  WORKSPACE_SERVICE_IDS,
  type WorkspaceServiceId,
} from './service-identifiers';
export {
  WorkspaceStateStore,
  DEFAULT_WORKSPACE_STATE,
} from './state/workspace-state';
export { CommandPalette } from './ui/command-palette';
export { renderDock } from './ui/dock';
export { renderSidebar } from './ui/sidebar';
export { renderWorkspaceShell } from './ui/workspace-shell';
export { WindowManager } from './windows/window-manager';
export {
  WorkspaceManager,
  type CreateWorkspaceOptions,
} from './workspaces/workspace-manager';
export type {
  DockRegion,
  WindowBounds,
  WindowItem,
  WindowLayout,
  WindowMode,
  WorkspaceCommand,
  WorkspaceItem,
  WorkspaceLayoutState,
  WorkspaceSystemState,
} from './types';
