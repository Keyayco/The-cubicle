import type {
  CommandExecutedEvent,
  CommandFailedEvent,
  CommandStartedEvent,
  PluginFailureEvent,
  Runtime,
  RuntimeStatusChange,
  SystemEvent,
  EventBus,
} from '../core';

type CubeState = 'idle' | 'working' | 'success' | 'failure' | 'stopped';

/**
 * Reflects real runtime, command, and plugin lifecycle events without polling.
 */
export class CubeIndicator {
  private readonly root: HTMLElement;
  private readonly label: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly activeOperations = new Set<string>();
  private readonly unsubscribeCallbacks: Array<() => void> = [];
  private runtimeStatus: string;
  private runtimeFailure = false;
  private batchFailed = false;
  private lastOutcome: 'success' | 'failure' | null = null;
  private lastFailureText = '';
  private compact = false;
  private renderPending = false;
  private renderedCompact = false;
  private compactAnimation: Animation | undefined;

  constructor(
    container: HTMLElement,
    private readonly eventBus: EventBus,
    runtime: Runtime,
  ) {
    this.runtimeStatus = runtime.getStatus();
    this.root = document.createElement('section');
    this.root.className = 'cube-stage';
    this.root.dataset.state = 'idle';
    this.root.dataset.compact = 'false';
    this.root.setAttribute('aria-label', 'Runtime status indicator');

    const visual = document.createElement('div');
    visual.className = 'cube-visual';
    visual.setAttribute('aria-hidden', 'true');
    const geometry = document.createElement('div');
    geometry.className = 'cube-geometry';
    for (const faceName of ['front', 'back', 'right', 'left', 'top', 'bottom']) {
      const face = document.createElement('div');
      face.className = `cube-face cube-face-${faceName}`;
      geometry.append(face);
    }
    visual.append(geometry);

    this.label = document.createElement('p');
    this.label.className = 'cube-status-label';
    this.label.setAttribute('role', 'status');
    this.label.setAttribute('aria-live', 'polite');
    this.detail = document.createElement('p');
    this.detail.className = 'cube-status-detail';
    this.root.append(visual, this.label, this.detail);
    container.append(this.root);

    this.unsubscribeCallbacks.push(
      this.eventBus.on<CommandStartedEvent>(
        'command:started',
        this.handleCommandStarted,
      ),
      this.eventBus.on<CommandExecutedEvent>(
        'command:executed',
        this.handleCommandExecuted,
      ),
      this.eventBus.on<CommandFailedEvent>(
        'command:failed',
        this.handleCommandFailed,
      ),
      this.eventBus.on<RuntimeStatusChange>(
        'runtime:status-changed',
        this.handleRuntimeStatusChanged,
      ),
      this.eventBus.on<unknown>('runtime:failed', this.handleRuntimeFailed),
      this.eventBus.on<{ pluginId: string }>(
        'plugin:loaded',
        this.handlePluginLoaded,
      ),
      this.eventBus.on<PluginFailureEvent>(
        'plugin:failed',
        this.handlePluginFailed,
      ),
    );

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.handleVisibilityChange();
    this.render();
  }

  public dispose(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.compactAnimation?.cancel();
    for (const unsubscribe of this.unsubscribeCallbacks.splice(0)) {
      unsubscribe();
    }
    this.root.remove();
  }

  private readonly handleCommandStarted = (
    event: SystemEvent<CommandStartedEvent>,
  ): void => {
    if (!event.payload) {
      return;
    }
    if (this.activeOperations.size === 0) {
      this.batchFailed = false;
      this.lastOutcome = null;
    }
    this.activeOperations.add(event.payload.operationId);
    this.render();
  };

  private readonly handleCommandExecuted = (
    event: SystemEvent<CommandExecutedEvent>,
  ): void => {
    if (!event.payload) {
      return;
    }
    this.activeOperations.delete(event.payload.operationId);
    if (this.activeOperations.size === 0) {
      this.lastOutcome = this.batchFailed ? 'failure' : 'success';
      if (!this.batchFailed) {
        this.compact = true;
        this.lastFailureText = '';
      }
    }
    this.render();
  };

  private readonly handleCommandFailed = (
    event: SystemEvent<CommandFailedEvent>,
  ): void => {
    if (!event.payload) {
      return;
    }
    this.activeOperations.delete(event.payload.operationId);
    this.batchFailed = true;
    this.lastFailureText = `Command ${event.payload.commandId} failed. Inspect terminal output.`;
    if (this.activeOperations.size === 0) {
      this.lastOutcome = 'failure';
    }
    this.render();
  };

  private readonly handleRuntimeStatusChanged = (
    event: SystemEvent<RuntimeStatusChange>,
  ): void => {
    const nextStatus = event.payload?.currentStatus;
    if (!nextStatus) {
      return;
    }
    this.runtimeStatus = nextStatus;
    if (nextStatus === 'error') {
      this.runtimeFailure = true;
      this.lastFailureText = 'Runtime entered the error state.';
    } else if (nextStatus === 'running') {
      this.runtimeFailure = false;
    }
    this.render();
  };

  private readonly handleRuntimeFailed = (): void => {
    this.runtimeFailure = true;
    this.lastFailureText = 'Runtime unhealthy. Inspect terminal output for diagnostics.';
    this.render();
  };

  private readonly handlePluginLoaded = (
    event: SystemEvent<{ pluginId: string }>,
  ): void => {
    if (!event.payload) {
      return;
    }
    this.compact = true;
    this.lastOutcome = 'success';
    this.lastFailureText = '';
    this.render();
  };

  private readonly handlePluginFailed = (
    event: SystemEvent<PluginFailureEvent>,
  ): void => {
    if (!event.payload) {
      return;
    }
    this.batchFailed = true;
    this.lastOutcome = 'failure';
    this.lastFailureText = `Plugin ${event.payload.pluginId} failed. Inspect terminal output.`;
    this.render();
  };

  private readonly handleVisibilityChange = (): void => {
    this.root.dataset.motionPaused = String(document.hidden);
    if (document.hidden) {
      this.compactAnimation?.pause();
    } else {
      if (this.renderPending) {
        this.render();
      }
      this.compactAnimation?.play();
    }
  };

  private render(): void {
    if (document.hidden) {
      this.renderPending = true;
      return;
    }
    this.renderPending = false;
    const shouldAnimateIntoCompact = this.compact && !this.renderedCompact;
    const previousRect = shouldAnimateIntoCompact
      ? this.root.getBoundingClientRect()
      : undefined;

    const transitionInProgress =
      this.runtimeStatus === 'initializing' || this.runtimeStatus === 'stopping';
    const activityInProgress =
      this.activeOperations.size > 0 || transitionInProgress;
    let state: CubeState;
    let label: string;
    let detail: string;

    if (this.runtimeFailure || this.runtimeStatus === 'error') {
      state = 'failure';
      label = 'Error';
      detail = this.lastFailureText || 'Runtime is unhealthy.';
    } else if (this.batchFailed && this.activeOperations.size > 0) {
      state = 'failure';
      label = 'Error';
      detail = this.lastFailureText || 'An operation failed.';
    } else if (activityInProgress) {
      state = 'working';
      label = 'Working';
      detail =
        this.activeOperations.size > 0
          ? `${this.activeOperations.size} command operation${this.activeOperations.size === 1 ? '' : 's'} in progress.`
          : `Runtime ${this.runtimeStatus}.`;
    } else if (this.lastOutcome === 'failure') {
      state = 'failure';
      label = 'Error';
      detail = this.lastFailureText || 'The last operation failed.';
    } else if (this.runtimeStatus === 'stopped') {
      state = 'stopped';
      label = 'Stopped';
      detail = 'Runtime is stopped.';
    } else if (this.lastOutcome === 'success') {
      state = 'success';
      label = 'Ready';
      detail = 'Runtime is ready.';
    } else if (this.runtimeStatus === 'running') {
      state = 'idle';
      label = 'Ready';
      detail = 'Runtime is ready for commands.';
    } else {
      state = 'idle';
      label = this.runtimeStatus === 'stopped' ? 'Stopped' : 'Starting';
      detail = `Runtime status: ${this.runtimeStatus}.`;
    }

    this.root.dataset.state = state;
    this.root.dataset.working = String(activityInProgress);
    this.root.dataset.compact = String(this.compact);
    if (this.root.parentElement) {
      this.root.parentElement.dataset.compact = String(this.compact);
    }
    this.root.setAttribute('aria-label', `Runtime status: ${label}`);
    this.label.textContent = label;
    this.detail.textContent = detail;
    this.renderedCompact = this.compact;

    if (previousRect && typeof this.root.animate === 'function') {
      const compactRect = this.root.getBoundingClientRect();
      const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      if (!prefersReducedMotion) {
        this.compactAnimation?.cancel();
        const animation = this.root.animate(
          [
            {
              transform: `translate(${previousRect.left - compactRect.left}px, ${previousRect.top - compactRect.top}px)`,
            },
            { transform: 'translate(0, 0)' },
          ],
          {
            duration: 520,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
          },
        );
        this.compactAnimation = animation;
        animation.onfinish = () => {
          if (this.compactAnimation === animation) {
            this.compactAnimation = undefined;
          }
        };
      }
    }
  }
}
