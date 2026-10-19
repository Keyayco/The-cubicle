import { bootstrapApplication } from '../src/core';
import {
  DEMO_GREETING_COMMAND_ID,
  DEMO_PLUGIN_ID,
  demoPlugin,
} from '../src/plugins/demo-plugin';
import { describe, expect, it } from 'vitest';

describe('demoPlugin', () => {
  it('is opt-in, registers a greeting command, and cleans up across lifecycle changes', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const app = await bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    expect(app.pluginLoader.list()).toEqual([]);
    expect(app.commandService.list()).toEqual([]);

    app.pluginLoader.register(demoPlugin);
    expect(app.pluginLoader.getStatus(DEMO_PLUGIN_ID)).toBe('registered');

    app.pluginLoader.load(DEMO_PLUGIN_ID);
    expect(app.pluginLoader.getStatus(DEMO_PLUGIN_ID)).toBe('loaded');
    expect(app.commandService.get(DEMO_GREETING_COMMAND_ID)).toMatchObject({
      id: DEMO_GREETING_COMMAND_ID,
      title: 'Say Hello',
      keywords: ['demo', 'greeting', 'hello'],
    });

    await expect(
      app.commandService.execute<undefined, string>(DEMO_GREETING_COMMAND_ID),
    ).resolves.toBe('Hello, world!');
    await expect(
      app.commandService.execute<{ name?: string }, string>(
        DEMO_GREETING_COMMAND_ID,
        { name: '  Ada  ' },
      ),
    ).resolves.toBe('Hello, Ada!');

    app.runtime.shutdown();
    expect(app.pluginLoader.getStatus(DEMO_PLUGIN_ID)).toBe('registered');
    expect(app.commandService.get(DEMO_GREETING_COMMAND_ID)).toBeUndefined();

    app.runtime.restart();
    expect(app.pluginLoader.getStatus(DEMO_PLUGIN_ID)).toBe('loaded');
    expect(app.commandService.get(DEMO_GREETING_COMMAND_ID)).toBeDefined();

    app.runtime.shutdown();
    expect(app.commandService.get(DEMO_GREETING_COMMAND_ID)).toBeUndefined();
    app.disposeUI();
  });

  it('can be explicitly opted into by the browser host through bootstrap options', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const app = await bootstrapApplication({
      plugins: [demoPlugin],
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    expect(app.pluginLoader.getStatus(DEMO_PLUGIN_ID)).toBe('loaded');
    expect(app.commandService.get(DEMO_GREETING_COMMAND_ID)).toBeDefined();
    app.disposeUI();
    app.runtime.shutdown();
  });
});
