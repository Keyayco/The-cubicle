import {
  ConfigurationService,
  CubeError,
  ErrorManager,
  EventBus,
  LocalStorageAdapter,
  Logger,
  MemoryStorageAdapter,
  normalizeError,
  Registry,
  Runtime,
  StorageService,
} from '../src/core';
import { describe, expect, it, vi } from 'vitest';

describe('Runtime failure path', () => {
  it('transitions to error, emits runtime:failed, and rethrows a normalized CubeError', () => {
    const registry = new Registry();
    const eventBus = new EventBus();
    const logger = new Logger({ sink: () => undefined });
    const storage = new StorageService(new MemoryStorageAdapter());
    const failingErrorManager = {
      capture: (error: unknown) => normalizeError(error, 'RUNTIME_ERROR'),
      attachGlobalHandlers: () => {
        throw new Error('global handler setup failed');
      },
      detachGlobalHandlers: () => undefined,
    } as unknown as ErrorManager;

    const runtime = new Runtime({
      config: new ConfigurationService(),
      errorManager: failingErrorManager,
      eventBus,
      logger,
      registry,
      storage,
    });

    const failedSpy = vi.fn();
    eventBus.on('runtime:failed', failedSpy);

    let thrown: unknown;
    try {
      runtime.initialize();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CubeError);
    expect((thrown as CubeError).code).toBe('RUNTIME_ERROR');
    expect(runtime.getStatus()).toBe('error');
    expect(failedSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ConfigurationService override behavior', () => {
  it('deep-merges runtime overrides over defaults while preserving untouched sections', () => {
    const config = new ConfigurationService({
      runtimeOverrides: {
        logging: { level: 'debug' },
        workspace: { title: 'Custom Title' },
      },
    });

    const all = config.getAll();
    expect(all.logging.level).toBe('debug');
    expect(all.workspace.title).toBe('Custom Title');
    expect(all.appName).toBe('Cube OS');
    expect(all.storage.driver).toBe('local');
  });

  it('accumulates incremental setRuntimeOverrides calls', () => {
    const config = new ConfigurationService();

    config.setRuntimeOverrides({ logging: { level: 'warn' } });
    config.setRuntimeOverrides({ logging: { enabled: false } });

    expect(config.getAll().logging.level).toBe('warn');
    expect(config.getAll().logging.enabled).toBe(false);
  });

  it('ignores undefined override values', () => {
    const config = new ConfigurationService({
      runtimeOverrides: {
        workspace: { title: undefined },
      },
    });

    expect(config.getAll().workspace.title).toBe('Cube OS Core Engine');
  });

  it('exposes a deeply frozen public configuration snapshot', () => {
    const config = new ConfigurationService();
    const all = config.getAll();

    expect(Object.isFrozen(all)).toBe(true);
    expect(Object.isFrozen(all.workspace)).toBe(true);
    expect(() => {
      (all as unknown as { appName: string }).appName = 'Hacked';
    }).toThrow();
  });
});

describe('ErrorManager global handlers', () => {
  it('captures window error events, emits system:error, and prevents default', () => {
    const eventBus = new EventBus();
    const logger = new Logger({ sink: () => undefined });
    const errorManager = new ErrorManager(logger, eventBus);
    const errorSpy = vi.fn();
    eventBus.on('system:error', errorSpy);

    errorManager.attachGlobalHandlers();

    const event = new ErrorEvent('error', {
      message: 'boom',
      error: new Error('boom'),
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalled();

    errorManager.detachGlobalHandlers();
  });

  it('stops capturing after handlers are detached', () => {
    const eventBus = new EventBus();
    const logger = new Logger({ sink: () => undefined });
    const errorManager = new ErrorManager(logger, eventBus);
    const errorSpy = vi.fn();
    eventBus.on('system:error', errorSpy);

    errorManager.attachGlobalHandlers();
    errorManager.detachGlobalHandlers();

    // Prevent jsdom from surfacing the dispatched error as an uncaught
    // exception while still asserting the error manager no longer reacts.
    const guard = (event: Event) => event.preventDefault();
    window.addEventListener('error', guard);
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'boom', error: new Error('boom') }),
    );
    window.removeEventListener('error', guard);

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('Logger level filtering', () => {
  it('emits only entries at or above the configured level', () => {
    const sink = vi.fn();
    const logger = new Logger({ level: 'warn', sink });

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    expect(sink).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[0][0].level).toBe('warn');
    expect(sink.mock.calls[1][0].level).toBe('error');
  });

  it('emits nothing when logging is disabled', () => {
    const sink = vi.fn();
    const logger = new Logger({ enabled: false, sink });

    logger.info('hidden message');

    expect(sink).not.toHaveBeenCalled();
  });
});

describe('LocalStorageAdapter', () => {
  it('namespaces keys and clears only its own namespace', async () => {
    const adapter = new LocalStorageAdapter(window.localStorage, 'cube-test');
    window.localStorage.setItem('unrelated:key', 'keep');

    await adapter.save('settings', { theme: 'dark' });
    expect(window.localStorage.getItem('cube-test:settings')).not.toBeNull();
    expect(await adapter.read<{ theme: string }>('settings')).toEqual({
      theme: 'dark',
    });
    expect(await adapter.exists('settings')).toBe(true);

    await adapter.clear();
    expect(window.localStorage.getItem('cube-test:settings')).toBeNull();
    expect(window.localStorage.getItem('unrelated:key')).toBe('keep');

    window.localStorage.clear();
  });
});

