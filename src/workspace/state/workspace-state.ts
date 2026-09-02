import type { WorkspaceSystemState } from '../types';

export type WorkspaceStateListener = (
  state: Readonly<WorkspaceSystemState>,
) => void;

const DEFAULT_WORKSPACE_STATE: WorkspaceSystemState = {
  workspaces: [],
  activeWorkspaceId: null,
  windows: [],
  focusedWindowId: null,
  layout: {
    nextZIndex: 1,
    defaultWindowBounds: {
      x: 48,
      y: 48,
      width: 480,
      height: 320,
    },
    dockRegions: ['none', 'left', 'right', 'bottom'],
  },
};

/**
 * Centralized state container for the workspace system.
 */
export class WorkspaceStateStore {
  private state: WorkspaceSystemState;

  private readonly listeners = new Set<WorkspaceStateListener>();

  constructor(initialState: WorkspaceSystemState = DEFAULT_WORKSPACE_STATE) {
    this.state = structuredClone(initialState);
  }

  /**
   * Returns an immutable snapshot of the current state.
   */
  public getState(): Readonly<WorkspaceSystemState> {
    return structuredClone(this.state);
  }

  /**
   * Replaces the entire state snapshot.
   */
  public replaceState(nextState: WorkspaceSystemState): void {
    this.state = structuredClone(nextState);
    this.notify();
  }

  /**
   * Updates state through a pure producer function.
   */
  public updateState(
    producer: (currentState: WorkspaceSystemState) => WorkspaceSystemState,
  ): void {
    this.state = structuredClone(producer(this.getMutableState()));
    this.notify();
  }

  /**
   * Registers a listener for state updates.
   */
  public subscribe(listener: WorkspaceStateListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private getMutableState(): WorkspaceSystemState {
    return structuredClone(this.state);
  }

  private notify(): void {
    const snapshot = this.getState();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

export { DEFAULT_WORKSPACE_STATE };
