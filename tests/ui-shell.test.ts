import {
  bootstrapApplication,
  type CommandDefinition,
} from '../src/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

let disposeCurrentUI: (() => void) | undefined;
let stopCurrentRuntime: (() => void) | undefined;

afterEach(() => {
  disposeCurrentUI?.();
  stopCurrentRuntime?.();
  disposeCurrentUI = undefined;
  stopCurrentRuntime = undefined;
  document.body.innerHTML = '';
});

const mountShell = async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const app = await bootstrapApplication({
    runtimeOverrides: {
      logging: { enabled: false },
      storage: { driver: 'memory' },
    },
  });
  disposeCurrentUI = app.disposeUI;
  stopCurrentRuntime = () => app.runtime.shutdown();
  return app;
};

const submitCommand = (commandId: string): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>('.terminal-input');
  const form = document.querySelector<HTMLFormElement>('.terminal-form');
  if (!input || !form) {
    throw new Error('Terminal controls were not rendered.');
  }
  input.value = commandId;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return input;
};

const flushCommand = async (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('The Cubicle shell', () => {
  it('renders the actual active workspace metadata and marks the view as a placeholder', async () => {
    const app = await mountShell();
    const workspace = document.querySelector('.application-workspace');

    expect(workspace?.textContent).toContain('Overview');
    expect(workspace?.textContent).toContain('metadata only');
    expect(workspace?.textContent).toContain('No application renderer');

    await app.workspaceManager.activateItem('runtime');
    expect(workspace?.textContent).toContain('Runtime');
    app.disposeUI();
  });

  it('dispatches a registered command through CommandService and compacts the cube after success', async () => {
    const app = await mountShell();
    const command: CommandDefinition<void, string> = {
      id: 'test.hello',
      title: 'Test greeting',
      keywords: ['test'],
      execute: () => 'Hello from the registered command.',
    };
    app.commandService.register(command);

    submitCommand('test.hello');
    const cube = document.querySelector<HTMLElement>('.cube-stage');
    const input = document.querySelector<HTMLInputElement>('.terminal-input');
    expect(input?.disabled).toBe(true);
    expect(cube?.dataset.state).toBe('working');

    await flushCommand();

    expect(document.querySelector('.terminal-output')?.textContent).toContain(
      'Hello from the registered command.',
    );
    expect(cube?.dataset.state).toBe('success');
    expect(cube?.dataset.compact).toBe('true');
    expect(document.querySelector('.cube-status-label')?.textContent).toBe(
      'Ready',
    );
    app.disposeUI();
  });

  it('reports Balances as unavailable instead of pretending to activate an app', async () => {
    const app = await mountShell();
    submitCommand('balances');
    await flushCommand();

    expect(document.querySelector('.terminal-output')?.textContent).toContain(
      'COMMAND_NOT_FOUND',
    );
    expect(document.querySelector('.terminal-output')?.textContent).toContain(
      'Unknown command "balances"',
    );
    expect(document.querySelector('.cube-stage')?.dataset.state).toBe('failure');
    expect(document.querySelector('.cube-stage')?.dataset.compact).toBe('false');
    app.disposeUI();
  });

  it('keeps a failed command red and renders output as text, not HTML', async () => {
    const app = await mountShell();
    app.commandService.register({
      id: 'test.fail',
      title: 'Fail',
      keywords: [],
      execute: () => {
        throw new Error('<img src=x onerror=alert(1)>');
      },
    });

    submitCommand('test.fail');
    await flushCommand();

    expect(document.querySelector('.cube-stage')?.dataset.state).toBe('failure');
    expect(document.querySelector('.terminal-output img')).toBeNull();
    expect(document.querySelector('.terminal-output')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
    app.disposeUI();
  });

  it('prevents duplicate submissions while a command is pending and supports history keys', async () => {
    const app = await mountShell();
    let resolveExecution: ((value: string) => void) | undefined;
    let executions = 0;
    const pending = new Promise<string>((resolve) => {
      resolveExecution = resolve;
    });
    app.commandService.register({
      id: 'test.pending',
      title: 'Pending',
      keywords: [],
      execute: () => {
        executions += 1;
        return pending;
      },
    });

    const input = submitCommand('test.pending');
    expect(input.disabled).toBe(true);
    document
      .querySelector<HTMLFormElement>('.terminal-form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(executions).toBe(1);

    resolveExecution?.('Finished.');
    await flushCommand();
    expect(input.disabled).toBe(false);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.value).toBe('test.pending');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(input.value).toBe('');
    app.disposeUI();
  });

  it('keeps the cube working until every concurrent command operation settles', async () => {
    const app = await mountShell();
    let finishFirst: (() => void) | undefined;
    let finishSecond: (() => void) | undefined;
    app.commandService.register({
      id: 'test.first',
      title: 'First',
      keywords: [],
      execute: () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    });
    app.commandService.register({
      id: 'test.second',
      title: 'Second',
      keywords: [],
      execute: () =>
        new Promise<void>((resolve) => {
          finishSecond = resolve;
        }),
    });

    const first = app.commandService.execute('test.first');
    const second = app.commandService.execute('test.second');
    const cube = document.querySelector<HTMLElement>('.cube-stage');
    expect(cube?.dataset.state).toBe('working');

    finishFirst?.();
    await first;
    expect(cube?.dataset.state).toBe('working');
    expect(cube?.getAttribute('aria-label')).toBe('Runtime status: Working');

    finishSecond?.();
    await second;
    expect(cube?.dataset.state).toBe('success');
    expect(cube?.dataset.compact).toBe('true');
    app.disposeUI();
  });

  it('keeps runtime failures visible after success and disposes every UI listener', async () => {
    const app = await mountShell();
    app.commandService.register({
      id: 'test.ok',
      title: 'Success',
      keywords: [],
      execute: () => 'ok',
    });
    submitCommand('test.ok');
    await flushCommand();
    expect(document.querySelector('.cube-stage')?.dataset.state).toBe('success');

    app.pluginLoader.register({
      id: 'test.runtime-failure',
      activate: () => {
        throw new Error('runtime failure');
      },
    });
    expect(() => app.runtime.restart()).toThrow();
    expect(app.runtime.getStatus()).toBe('error');
    expect(document.querySelector('.cube-stage')?.dataset.compact).toBe('true');
    expect(document.querySelector('.cube-stage')?.dataset.state).toBe('failure');
    expect(document.querySelector('.cube-status-label')?.textContent).toBe(
      'Error',
    );

    expect(app.eventBus.listenerCount()).toBeGreaterThan(0);
    app.disposeUI();
    expect(app.eventBus.listenerCount()).toBe(0);
  });

  it('bounds terminal output and discovers only commands registered in the shared registry', async () => {
    const app = await mountShell();
    app.commandService.register({
      id: 'test.ping',
      title: 'Ping',
      keywords: [],
      execute: () => 'pong',
    });

    submitCommand('help');
    expect(document.querySelector('.terminal-output')?.textContent).toContain(
      'test.ping',
    );
    expect(document.querySelector('.terminal-output')?.textContent).not.toContain(
      'balances',
    );

    for (let index = 0; index < 220; index += 1) {
      await app.commandService.execute('test.ping');
    }
    expect(
      document.querySelectorAll('.terminal-output .terminal-line').length,
    ).toBeLessThanOrEqual(200);
    app.disposeUI();
  });

  it('defers terminal DOM updates while hidden and flushes them when visible', async () => {
    const app = await mountShell();
    const output = document.querySelector('.terminal-output');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    app.eventBus.emit('runtime:status-changed', {
      previousStatus: 'running',
      currentStatus: 'stopping',
    });
    expect(output?.textContent).not.toContain('Runtime: stopping');

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(output?.textContent).toContain('Runtime: stopping');

    hidden.mockRestore();
    app.disposeUI();
  });
});
