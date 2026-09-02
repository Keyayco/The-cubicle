/**
 * Canonical service identifiers for Phase 2 workspace services.
 */
export const WORKSPACE_SERVICE_IDS = {
  commandPalette: 'commandPalette',
  layoutManager: 'layoutManager',
  windowManager: 'windowManager',
  workspaceManager: 'workspaceManager',
  workspaceState: 'workspaceState',
} as const;

export type WorkspaceServiceId =
  (typeof WORKSPACE_SERVICE_IDS)[keyof typeof WORKSPACE_SERVICE_IDS];
