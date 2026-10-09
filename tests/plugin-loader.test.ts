import {
  ConfigurationService,
  CommandService,
  CubeError,
  ErrorManager,
  EventBus,
  Logger,
  MemoryStorageAdapter,
  PluginLoader,
  Registry,
  StorageService,
} from '../src/core';
import { describe, expect, it, vi } from 'vitest';

const createPluginLoader = () => {
  const config = new ConfigurationService();
  const registry = new Registry();
  const eventBus = new EventBus();
  const logger = new Logger({ sink: () => undefined });
  const errorManager = new ErrorManager(logger, eventBus);
  const storage = new StorageService(new MemoryStorageAdapter());
  const commandService = new CommandService(
    registry,
    eventBus,
    errorManager,
    logger,
  );
  const loader = new PluginLoader(
    registry,
    { commands: commandService, config, eventBus, logger, registry, storage },
    errorManager,
    eventBus,
    logger,
  );

  return {
    commandService,
    config,
    errorManager,
    eventBus,
    loader,
    logger,
    registry,
    storage,
  };
};

describe('PluginLoader', () => {
  it('registers definitions in the shared registry and supports lookup', () => {
    const { loader, registry } = createPluginLoader();
    const definition = {
      id: 'demo.sample',
      activate: vi.fn(),
    };

    loader.register(definition);

    expect(registry.get('plugins', 'demo.sample')).toBeDefined();
    expect(loader.getPlugin('demo.sample')).toMatchObject(definition);
    expect(Object.isFrozen(loader.getPlugin('demo.sample'))).toBe(true);
    expect(loader.getStatus('demo.sample')).toBe('registered');
    expect(loader.list()).toEqual(['demo.sample']);
  });

  it('rejects invalid definitions and duplicate plugin identifiers', () => {
    const { loader } = createPluginLoader();

    expect(() => loader.register({ id: ' ', activate: vi.fn() })).toThrow(
      expect.objectContaining({ code: 'PLUGIN_DEFINITION_INVALID' }),
    );
    expect(() => loader.register({ id: 'broken', activate: undefined as never }))
      .toThrow(expect.objectContaining({ code: 'PLUGIN_DEFINITION_INVALID' }));

    loader.register({ id: 'demo.duplicate', activate: vi.fn() });
    expect(() =>
      loader.register({ id: 'demo.duplicate', activate: vi.fn() }),
    ).toThrow('Cannot register duplicate plugin');
  });

  it('executes a plugin once, emits lifecycle events, and unloads with cleanup', () => {
    const { eventBus, loader } = createPluginLoader();
    const activate = vi.fn();
    const cleanup = vi.fn();
    const loaded = vi.fn();
    const unloaded = vi.fn();
    eventBus.on('plugin:loaded', loaded);
    eventBus.on('plugin:unloaded', unloaded);

    loader.register({
      id: 'demo.lifecycle',
      activate: (context) => {
        expect(context.registry).toBeDefined();
        activate();
        return cleanup;
      },
    });

    loader.load('demo.lifecycle');
    loader.load('demo.lifecycle');
    expect(activate).toHaveBeenCalledTimes(1);
    expect(loader.getStatus('demo.lifecycle')).toBe('loaded');
    expect(loaded).toHaveBeenCalledTimes(1);

    loader.unload('demo.lifecycle');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(loader.getStatus('demo.lifecycle')).toBe('registered');
    expect(unloaded).toHaveBeenCalledTimes(1);
  });

  it('reports unknown plugin identifiers with a typed error', () => {
    const { loader } = createPluginLoader();

    expect(() => loader.load('missing.plugin')).toThrow(
      expect.objectContaining({ code: 'PLUGIN_NOT_FOUND' }),
    );
    expect(loader.getPlugin('missing.plugin')).toBeUndefined();
  });

  it('normalizes activation failures, reports them, and allows a retry', () => {
    const { eventBus, loader } = createPluginLoader();
    const failure = new Error('activation failed');
    const failed = vi.fn();
    const systemError = vi.fn();
    const activate = vi.fn()
      .mockImplementationOnce(() => {
        throw failure;
      })
      .mockImplementationOnce(() => undefined);
    eventBus.on('plugin:failed', failed);
    eventBus.on('system:error', systemError);
    loader.register({ id: 'demo.retry', activate });

    expect(() => loader.load('demo.retry')).toThrow(
      expect.objectContaining({ code: 'PLUGIN_LOAD_FAILED' }),
    );
    expect(loader.getStatus('demo.retry')).toBe('failed');
    expect(failed).toHaveBeenCalledTimes(1);
    expect(systemError).toHaveBeenCalledTimes(1);

    loader.load('demo.retry');
    expect(loader.getStatus('demo.retry')).toBe('loaded');
    expect(activate).toHaveBeenCalledTimes(2);
  });

  it('rejects reentrant lifecycle calls while activation is in progress', () => {
    const { loader } = createPluginLoader();
    let reentrantError: unknown;
    loader.register({
      id: 'demo.reentrant',
      activate: () => {
        try {
          loader.unload('demo.reentrant');
        } catch (error) {
          reentrantError = error;
        }
      },
    });

    loader.load('demo.reentrant');

    expect(reentrantError).toBeInstanceOf(CubeError);
    expect((reentrantError as CubeError).code).toBe('PLUGIN_INVALID_STATE');
    expect(loader.getStatus('demo.reentrant')).toBe('loaded');
  });

  it('unloads all plugins in reverse order and continues after cleanup errors', () => {
    const { eventBus, loader } = createPluginLoader();
    const calls: string[] = [];
    const failed = vi.fn();
    eventBus.on('plugin:failed', failed);

    loader.register({
      id: 'demo.first',
      activate: () => () => calls.push('first'),
    });
    loader.register({
      id: 'demo.second',
      activate: () => () => {
        calls.push('second');
        throw new Error('cleanup failed');
      },
    });
    loader.register({
      id: 'demo.third',
      activate: () => () => calls.push('third'),
    });

    loader.loadAll();
    loader.unloadAll();

    expect(calls).toEqual(['third', 'second', 'first']);
    expect(failed).toHaveBeenCalledTimes(1);
    expect(loader.getStatus('demo.first')).toBe('registered');
    expect(loader.getStatus('demo.second')).toBe('failed');
    expect(loader.getStatus('demo.third')).toBe('registered');
  });

  it('rolls back already-loaded plugins when loadAll fails', () => {
    const { loader } = createPluginLoader();
    const firstCleanup = vi.fn();
    loader.register({
      id: 'demo.first',
      activate: () => firstCleanup,
    });
    loader.register({
      id: 'demo.failure',
      activate: () => {
        throw new Error('activation failed');
      },
    });

    expect(() => loader.loadAll()).toThrow(
      expect.objectContaining({ code: 'PLUGIN_LOAD_FAILED' }),
    );
    expect(firstCleanup).toHaveBeenCalledTimes(1);
    expect(loader.getStatus('demo.first')).toBe('registered');
    expect(loader.getStatus('demo.failure')).toBe('failed');
  });
});
