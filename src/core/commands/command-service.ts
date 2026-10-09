import { CubeError, normalizeError } from '../errors/cube-error';
import type { ErrorManager } from '../errors/error-manager';
import type { EventBus } from '../events/event-bus';
import type { LoggerContract } from '../logger/types';
import type { Registry } from '../registry/registry';

/**
 * A command registered in the central command registry.
 *
 * `title` and `keywords` preserve the existing workspace-command metadata
 * contract without introducing any palette or UI behavior into core.
 */
export interface CommandDefinition<TArgs = void, TResult = unknown> {
  id: string;
  title: string;
  keywords: readonly string[];
  execute: (args: TArgs) => TResult | Promise<TResult>;
}

export interface CommandExecutedEvent {
  commandId: string;
  result: unknown;
}

export interface CommandFailedEvent {
  commandId: string;
  error: CubeError;
}

/**
 * Registers and executes commands through the shared Registry.
 */
export class CommandService {
  constructor(
    private readonly registry: Registry,
    private readonly eventBus: EventBus,
    private readonly errorManager: ErrorManager,
    private readonly logger: LoggerContract,
  ) {}

  /**
   * Registers a command definition. Duplicate IDs are rejected by Registry.
   */
  public register<TArgs = void, TResult = unknown>(
    definition: CommandDefinition<TArgs, TResult>,
  ): void {
    if (
      typeof definition?.id !== 'string' ||
      definition.id.length === 0 ||
      definition.id.trim() !== definition.id ||
      typeof definition.title !== 'string' ||
      definition.title.trim().length === 0 ||
      !Array.isArray(definition.keywords) ||
      definition.keywords.some((keyword) => typeof keyword !== 'string') ||
      typeof definition.execute !== 'function'
    ) {
      throw new CubeError('Command definition is invalid.', {
        code: 'COMMAND_DEFINITION_INVALID',
        details: { commandId: definition?.id },
      });
    }

    const command = Object.freeze({
      ...definition,
      keywords: Object.freeze([...definition.keywords]),
    });

    this.registry.register('commands', definition.id, command);
  }

  /**
   * Looks up a command by its stable identifier.
   */
  public get<TArgs = void, TResult = unknown>(
    commandId: string,
  ): CommandDefinition<TArgs, TResult> | undefined {
    return this.registry.get<CommandDefinition<TArgs, TResult>>(
      'commands',
      commandId,
    );
  }

  /**
   * Lists command identifiers in registration order.
   */
  public list(): string[] {
    return this.registry.list('commands');
  }

  /**
   * Removes a command from the shared command registry.
   */
  public unregister(commandId: string): boolean {
    return this.registry.unregister('commands', commandId);
  }

  /**
   * Executes a command and reports completion or failure through EventBus.
   */
  public async execute<TArgs = void, TResult = unknown>(
    commandId: string,
    args?: TArgs,
  ): Promise<TResult> {
    const command = this.get<TArgs, TResult>(commandId);

    if (!command) {
      const error = new CubeError(`Unknown command "${commandId}".`, {
        code: 'COMMAND_NOT_FOUND',
        details: { commandId },
      });
      this.eventBus.emit<CommandFailedEvent>(
        'command:failed',
        { commandId, error },
        { source: 'command-service' },
      );
      throw error;
    }

    let result: TResult;
    try {
      result = (await command.execute(args as TArgs)) as TResult;
    } catch (error) {
      const normalizedError = this.errorManager.capture(
        normalizeError(error, 'COMMAND_EXECUTION_FAILED', { commandId }),
        {
          source: 'command-service.execute',
          details: { commandId },
        },
      );
      this.eventBus.emit<CommandFailedEvent>(
        'command:failed',
        { commandId, error: normalizedError },
        { source: 'command-service' },
      );
      throw normalizedError;
    }

    this.logger.info('Command executed.', { commandId });
    this.eventBus.emit<CommandExecutedEvent>(
      'command:executed',
      { commandId, result },
      { source: 'command-service' },
    );
    return result;
  }
}
