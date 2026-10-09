import {
  CommandService,
  ConfigurationService,
  ErrorManager,
  EventBus,
  Logger,
  MemoryStorageAdapter,
  PluginLoader,
  Registry,
  StorageService,
} from '../src/core';
import { describe, expect, it, vi } from 'vitest';

const createCommandService = () => {
  const registry = new Registry();
  const eventBus = new EventBus();
  const logger = new Logger({ sink: () => undefined });
  const errorManager = new ErrorManager(logger, eventBus);
  const commandService = new CommandService(
    registry,
    eventBus,
    errorManager,
    logger,
  );

  return { commandService, errorManager, eventBus, logger, registry };
};

describe('CommandService', () => {
  it('registers, looks up, and lists commands in the shared registry', () => {
    const { commandService, registry } = createCommandService();
    const command = {
      id: 'demo.greet',
      title: 'Greet',
      keywords: ['hello', 'welcome'],
      execute: () => 'hello',
    };

    commandService.register(command);

    expect(commandService.get('demo.greet')).toMatchObject(command);
    expect(commandService.list()).toEqual(['demo.greet']);
    expect(registry.get('commands', 'demo.greet')).toBeDefined();
  });

  it('rejects invalid metadata and duplicate identifiers', () => {
    const { commandService } = createCommandService();

    expect(() =>
      commandService.register({
        id: ' ',
        title: 'Bad ID',
        keywords: [],
        execute: () => undefined,
      }),
    ).toThrow(expect.objectContaining({ code: 'COMMAND_DEFINITION_INVALID' }));
    expect(() =>
      commandService.register({
        id: 'bad',
        title: ' ',
        keywords: [],
        execute: () => undefined,
      }),
    ).toThrow(expect.objectContaining({ code: 'COMMAND_DEFINITION_INVALID' }));
    expect(() =>
      commandService.register({
        id: 'bad',
        title: 'Bad',
        keywords: [1 as never],
        execute: () => undefined,
      }),
    ).toThrow(expect.objectContaining({ code: 'COMMAND_DEFINITION_INVALID' }));

    commandService.register({
      id: 'demo.duplicate',
      title: 'First',
      keywords: [],
      execute: () => undefined,
    });
    expect(() =>
      commandService.register({
        id: 'demo.duplicate',
        title: 'Second',
        keywords: [],
        execute: () => undefined,
      }),
    ).toThrow('Cannot register duplicate command');
  });

  it('executes a synchronous command and emits its result', async () => {
    const { commandService, eventBus } = createCommandService();
    const handler = vi.fn(() => 'done');
    const executed = vi.fn();
    eventBus.on('command:executed', executed);
    commandService.register({
      id: 'demo.sync',
      title: 'Synchronous',
      keywords: [],
      execute: handler,
    });

    await expect(commandService.execute('demo.sync')).resolves.toBe('done');
    expect(handler).toHaveBeenCalledOnce();
    expect(executed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { commandId: 'demo.sync', result: 'done' },
      }),
    );
  });

  it('supports asynchronous execution with typed input and output', async () => {
    const { commandService } = createCommandService();
    commandService.register<{ value: number }, number>({
      id: 'demo.double',
      title: 'Double a value',
      keywords: ['math'],
      execute: async (args) => args.value * 2,
    });

    await expect(
      commandService.execute<{ value: number }, number>('demo.double', {
        value: 21,
      }),
    ).resolves.toBe(42);
  });

  it('rejects unknown command IDs with a typed error and failure event', async () => {
    const { commandService, eventBus } = createCommandService();
    const failed = vi.fn();
    eventBus.on('command:failed', failed);

    await expect(commandService.execute('missing.command')).rejects.toMatchObject({
      code: 'COMMAND_NOT_FOUND',
    });
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          commandId: 'missing.command',
          error: expect.objectContaining({ code: 'COMMAND_NOT_FOUND' }),
        }),
      }),
    );
  });

  it('normalizes handler failures and emits central and command errors', async () => {
    const { commandService, eventBus } = createCommandService();
    const failed = vi.fn();
    const systemError = vi.fn();
    eventBus.on('command:failed', failed);
    eventBus.on('system:error', systemError);
    commandService.register({
      id: 'demo.fails',
      title: 'Fail',
      keywords: [],
      execute: () => {
        throw new Error('handler failed');
      },
    });

    await expect(commandService.execute('demo.fails')).rejects.toMatchObject({
      code: 'COMMAND_EXECUTION_FAILED',
      message: 'handler failed',
    });
    expect(failed).toHaveBeenCalledTimes(1);
    expect(systemError).toHaveBeenCalledTimes(1);
  });

  it('unregisters commands and reports unknown IDs', () => {
    const { commandService } = createCommandService();
    commandService.register({
      id: 'demo.remove',
      title: 'Remove me',
      keywords: [],
      execute: () => undefined,
    });

    expect(commandService.unregister('demo.remove')).toBe(true);
    expect(commandService.unregister('demo.remove')).toBe(false);
    expect(commandService.get('demo.remove')).toBeUndefined();
  });

  it('lets plugins register and dispose their commands through PluginContext', async () => {
    const { commandService, errorManager, eventBus, logger, registry } =
      createCommandService();
    const config = new ConfigurationService();
    const storage = new StorageService(new MemoryStorageAdapter());
    const pluginLoader = new PluginLoader(
      registry,
      { commands: commandService, config, eventBus, logger, registry, storage },
      errorManager,
      eventBus,
      logger,
    );

    pluginLoader.register({
      id: 'demo.commands',
      activate: ({ commands }) => {
        commands.register({
          id: 'demo.commands.ping',
          title: 'Ping',
          keywords: ['health'],
          execute: () => 'pong',
        });
        return () => {
          commands.unregister('demo.commands.ping');
        };
      },
    });

    pluginLoader.load('demo.commands');
    await expect(
      commandService.execute('demo.commands.ping'),
    ).resolves.toBe('pong');

    pluginLoader.unload('demo.commands');
    expect(commandService.get('demo.commands.ping')).toBeUndefined();
  });
});
