import type { EventBus } from '../../core';
import type { WindowBounds, WindowItem, WindowLayout } from '../types';

const cloneBounds = (bounds: WindowBounds): WindowBounds => ({ ...bounds });

/**
 * Computes serializable window layout information for the workspace system.
 */
export class LayoutManager {
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Creates the initial layout for a newly opened window.
   */
  public createWindowLayout(
    existingWindowCount: number,
    defaultBounds: WindowBounds,
  ): WindowLayout {
    const offset = existingWindowCount * 28;

    return {
      bounds: {
        x: defaultBounds.x + offset,
        y: defaultBounds.y + offset,
        width: defaultBounds.width,
        height: defaultBounds.height,
      },
      previousBounds: null,
      dockRegion: 'none',
    };
  }

  /**
   * Marks a window as minimized while preserving its previous bounds.
   */
  public minimizeWindow(window: WindowItem): WindowItem {
    return {
      ...window,
      mode: 'minimized',
      isFocused: false,
      updatedAt: Date.now(),
      layout: {
        ...window.layout,
        previousBounds: cloneBounds(window.layout.bounds),
      },
    };
  }

  /**
   * Marks a window as maximized within the active workspace surface.
   */
  public maximizeWindow(
    window: WindowItem,
    containerBounds: WindowBounds,
  ): WindowItem {
    const nextWindow: WindowItem = {
      ...window,
      mode: 'maximized',
      updatedAt: Date.now(),
      layout: {
        ...window.layout,
        previousBounds: cloneBounds(window.layout.bounds),
        bounds: cloneBounds(containerBounds),
      },
    };

    this.eventBus.emit('layout:changed', {
      windowId: window.id,
      workspaceId: window.workspaceId,
      mode: 'maximized',
    });

    return nextWindow;
  }

  /**
   * Restores a window from a minimized or maximized state.
   */
  public restoreWindow(window: WindowItem): WindowItem {
    const bounds = window.layout.previousBounds ?? window.layout.bounds;

    const nextWindow: WindowItem = {
      ...window,
      mode: 'normal',
      updatedAt: Date.now(),
      layout: {
        ...window.layout,
        bounds: cloneBounds(bounds),
        previousBounds: null,
      },
    };

    this.eventBus.emit('layout:changed', {
      windowId: window.id,
      workspaceId: window.workspaceId,
      mode: 'normal',
    });

    return nextWindow;
  }
}
