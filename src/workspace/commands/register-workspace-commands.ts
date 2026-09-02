import type { Registry } from '../../core';
import type { WorkspaceCommand } from '../types';
import type { WorkspaceCommandDependencies } from './types';

export const WORKSPACE_COMMAND_IDS = {
  closeWorkspace: 'workspace.close',
  openWorkspace: 'workspace.open',
  switchWorkspace: 'workspace.switch',
} as const;

/**
 * Registers the Phase 2 command palette commands.
 */
export const registerWorkspaceCommands = (
  registry: Registry,
  dependencies: WorkspaceCommandDependencies,
): WorkspaceCommand[] => {
  const commands: WorkspaceCommand[] = [
    {
      id: WORKSPACE_COMMAND_IDS.openWorkspace,
      title: 'Open Workspace',
      keywords: ['workspace', 'open', 'create'],
      execute: dependencies.createWorkspace,
    },
    {
      id: WORKSPACE_COMMAND_IDS.closeWorkspace,
      title: 'Close Workspace',
      keywords: ['workspace', 'close'],
      execute: dependencies.closeActiveWorkspace,
    },
    {
      id: WORKSPACE_COMMAND_IDS.switchWorkspace,
      title: 'Switch Workspace',
      keywords: ['workspace', 'switch', 'cycle'],
      execute: dependencies.switchWorkspace,
    },
  ];

  for (const command of commands) {
    if (!registry.has('commands', command.id)) {
      registry.register('commands', command.id, command);
    }
  }

  return commands;
};
