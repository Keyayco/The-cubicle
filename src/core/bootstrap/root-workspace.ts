import type { CubeConfig } from '../config/default-config';
import type { Runtime } from '../runtime/runtime';

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
  workspace.setAttribute('data-runtime-status', runtime.getStatus());

  const title = document.createElement('h1');
  title.textContent = config.workspace.title;

  const description = document.createElement('p');
  description.textContent = config.workspace.description;

  const status = document.createElement('p');
  status.className = 'cube-runtime-status';
  status.textContent = `Runtime status: ${runtime.getStatus()}`;

  workspace.append(title, description, status);
  container.append(workspace);
};
