import type { WorkspaceCommand } from '../types';

/**
 * Dependencies used by workspace command handlers.
 */
export interface WorkspaceCommandDependencies {
  createWorkspace: () => void;
  closeActiveWorkspace: () => void;
  switchWorkspace: () => void;
}

/**
 * Registry command map for the command palette.
 */
export type WorkspaceCommandMap = WorkspaceCommand[];
