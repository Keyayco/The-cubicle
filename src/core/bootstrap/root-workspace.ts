import type { CubeConfig } from '../config/default-config';
import type { Runtime, RuntimeStatusChange } from '../runtime/runtime';

/**
 * Renders the minimal root workspace required for Phase 1 boot validation.
 */
export const renderRootWorkspace = (
  container: HTMLElement,
  config: Readonly<CubeConfig>,
  runtime: Runtime,
): void => {
  container.innerHTML = '';

  const workspace = document.createElement('main');
  workspace.className = 'cube-root-workspace';

  const title = document.createElement('h1');
  title.textContent = config.workspace.title;

  const description = document.createElement('p');
  description.textContent = config.workspace.description;

  const status = document.createElement('p');
  status.className = 'cube-runtime-status';

  const syncRuntimeStatus = (value: string): void => {
    workspace.setAttribute('data-runtime-status', value);
    status.textContent = `Runtime status: ${value}`;
  };

  syncRuntimeStatus(runtime.getStatus());

  runtime
    .getServices()
    .eventBus.on<RuntimeStatusChange>('runtime:status-changed', (event) => {
      if (!event.payload) {
        return;
      }

      syncRuntimeStatus(event.payload.currentStatus);
    });

  workspace.append(title, description, status);
  container.append(workspace);
};
