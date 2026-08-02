import {
  bootstrapApplication,
  CORE_SERVICE_IDS,
  EventBus,
  MemoryStorageAdapter,
  Registry,
  StorageService,
} from '../src/core';
import { describe, expect, it, vi } from 'vitest';

describe('EventBus', () => {
  it('prevents duplicate listener registration and supports unsubscribe', () => {
    const eventBus = new EventBus();
    const listener = vi.fn();

    const unsubscribe = eventBus.on('runtime:test', listener);
    eventBus.on('runtime:test', listener);

    expect(eventBus.listenerCount('runtime:test')).toBe(1);

    eventBus.emit('runtime:test', { value: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(eventBus.listenerCount('runtime:test')).toBe(0);
  });
});

describe('Registry', () => {
  it('registers, retrieves, verifies, lists, and unregisters objects', () => {
    const registry = new Registry();
    const service = { healthy: true };

    registry.register('services', 'health', service);

    expect(registry.get('services', 'health')).toBe(service);
    expect(registry.has('services', 'health')).toBe(true);
    expect(registry.list('services')).toEqual(['health']);

    registry.unregister('services', 'health');
    expect(registry.has('services', 'health')).toBe(false);
  });
});

describe('StorageService', () => {
  it('supports save, read, update, delete, exists, and clear', async () => {
    const storage = new StorageService(new MemoryStorageAdapter());

    await storage.save('settings', { theme: 'dark', version: 1 });
    expect(await storage.exists('settings')).toBe(true);
    expect(await storage.read<{ theme: string }>('settings')).toEqual({
      theme: 'dark',
      version: 1,
    });

    const updated = await storage.update<{ theme: string; version: number }>(
      'settings',
      (current) => ({
        theme: current?.theme ?? 'dark',
        version: (current?.version ?? 0) + 1,
      }),
    );

    expect(updated.version).toBe(2);

    await storage.delete('settings');
    expect(await storage.exists('settings')).toBe(false);

    await storage.save('temp', { value: true });
    await storage.clear();
    expect(await storage.exists('temp')).toBe(false);
  });
});

describe('bootstrapApplication', () => {
  it('boots the runtime, registers core services, and renders the root workspace', () => {
    document.body.innerHTML = '<div id="app"></div>';

    const result = bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    expect(result.runtime.getStatus()).toBe('running');
    expect(result.registry.has('services', CORE_SERVICE_IDS.runtime)).toBe(true);
    expect(result.registry.has('services', CORE_SERVICE_IDS.logger)).toBe(true);
    expect(document.querySelector('.cube-root-workspace')).not.toBeNull();
    expect(document.body.textContent).toContain('Core Engine');
  });
});
