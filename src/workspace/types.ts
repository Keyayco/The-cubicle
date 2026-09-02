/**
 * Dock regions reserved for future layout strategies.
 */
export type DockRegion = 'none' | 'left' | 'right' | 'bottom';

/**
 * Supported window presentation modes.
 */
export type WindowMode = 'normal' | 'minimized' | 'maximized';

/**
 * Serializable rectangle used for workspace window bounds.
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Serializable layout information stored alongside each window.
 */
export interface WindowLayout {
  bounds: WindowBounds;
  previousBounds: WindowBounds | null;
  dockRegion: DockRegion;
}

/**
 * Serializable workspace record.
 */
export interface WorkspaceItem {
  id: string;
  name: string;
  isOpen: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Serializable window record.
 */
export interface WindowItem {
  id: string;
  workspaceId: string;
  title: string;
  mode: WindowMode;
  zIndex: number;
  isFocused: boolean;
  createdAt: number;
  updatedAt: number;
  layout: WindowLayout;
}

/**
 * Global workspace layout metadata.
 */
export interface WorkspaceLayoutState {
  nextZIndex: number;
  defaultWindowBounds: WindowBounds;
  dockRegions: DockRegion[];
}

/**
 * Centralized serializable Phase 2 state.
 */
export interface WorkspaceSystemState {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  windows: WindowItem[];
  focusedWindowId: string | null;
  layout: WorkspaceLayoutState;
}

/**
 * Registry-stored command contract used by the command palette.
 */
export interface WorkspaceCommand {
  id: string;
  title: string;
  keywords: string[];
  execute: () => void | Promise<void>;
}
