import type { EventBus } from '../events/event-bus';
import type { StorageService } from '../storage/storage-service';

export const WORKSPACE_STORAGE_KEY = 'workspace:state';

export type WorkspaceItemKind = 'system' | 'plugin';

export interface WorkspaceItem {
  id: string;
  title: string;
  description: string;
  kind: WorkspaceItemKind;
}

export interface WorkspaceState {
  items: WorkspaceItem[];
  activeItemId: string | null;
}

export interface WorkspaceSnapshot extends WorkspaceState {
  hydrated: boolean;
}

export interface WorkspaceActiveItemChange {
  currentItemId: string | null;
  previousItemId: string | null;
}

const cloneItems = (items: WorkspaceItem[]): WorkspaceItem[] =>
  structuredClone(items);

const cloneState = (state: WorkspaceState): WorkspaceState => ({
  items: cloneItems(state.items),
  activeItemId: state.activeItemId,
});

/**
 * Manages persisted workspace state and exposes item-level mutations.
 */
export class WorkspaceManager {
  private state: WorkspaceState = {
    items: [],
    activeItemId: null,
  };

  private hydrated = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly storage: StorageService,
    private readonly storageKey: string = WORKSPACE_STORAGE_KEY,
  ) {}

  /**
   * Hydrates workspace state from storage and backfills missing seed items.
   */
  public async initialize(seedItems: WorkspaceItem[] = []): Promise<WorkspaceSnapshot> {
    const persisted = await this.storage.read<WorkspaceState>(this.storageKey);
    this.state = this.buildInitialState(seedItems, persisted);
    this.hydrated = true;
    await this.persistState();

    const snapshot = this.getSnapshot();
    this.eventBus.emit('workspace:initialized', snapshot, {
      source: 'workspace',
    });
    this.emitStateChanged();
    return snapshot;
  }

  /**
   * Returns whether the workspace has loaded its initial state.
   */
  public isHydrated(): boolean {
    return this.hydrated;
  }

  /**
   * Returns the current immutable workspace snapshot.
   */
  public getSnapshot(): WorkspaceSnapshot {
    return {
      ...cloneState(this.state),
      hydrated: this.hydrated,
    };
  }

  /**
   * Lists all workspace items.
   */
  public listItems(): WorkspaceItem[] {
    return cloneItems(this.state.items);
  }

  /**
   * Returns the currently active workspace item.
   */
  public getActiveItem(): WorkspaceItem | null {
    const activeItem = this.state.items.find(
      (item) => item.id === this.state.activeItemId,
    );
    return activeItem ? structuredClone(activeItem) : null;
  }

  /**
   * Registers a new workspace item and optionally activates it.
   */
  public async registerItem(
    item: WorkspaceItem,
    options?: {
      activate?: boolean;
    },
  ): Promise<WorkspaceSnapshot> {
    this.ensureHydrated();

    if (this.state.items.some((existingItem) => existingItem.id === item.id)) {
      throw new Error(`Workspace item "${item.id}" is already registered.`);
    }

    const previousActiveItemId = this.state.activeItemId;
    const nextItems = [...this.state.items, structuredClone(item)];
    const nextActiveItemId =
      options?.activate || previousActiveItemId === null
        ? item.id
        : previousActiveItemId;

    this.state = {
      items: nextItems,
      activeItemId: nextActiveItemId,
    };

    await this.persistState();

    this.eventBus.emit('workspace:item-registered', structuredClone(item), {
      source: 'workspace',
    });

    if (previousActiveItemId !== nextActiveItemId) {
      this.emitActiveItemChanged(previousActiveItemId, nextActiveItemId);
    }

    return this.emitStateChanged();
  }

  /**
   * Activates an existing workspace item by identifier.
   */
  public async activateItem(itemId: string): Promise<WorkspaceSnapshot> {
    this.ensureHydrated();

    if (!this.state.items.some((item) => item.id === itemId)) {
      throw new Error(`Workspace item "${itemId}" is not registered.`);
    }

    const previousActiveItemId = this.state.activeItemId;

    if (previousActiveItemId === itemId) {
      return this.getSnapshot();
    }

    this.state = {
      ...this.state,
      activeItemId: itemId,
    };

    await this.persistState();
    this.emitActiveItemChanged(previousActiveItemId, itemId);
    return this.emitStateChanged();
  }

  /**
   * Removes a workspace item by identifier.
   */
  public async removeItem(itemId: string): Promise<boolean> {
    this.ensureHydrated();

    const removedItem = this.state.items.find((item) => item.id === itemId);

    if (!removedItem) {
      return false;
    }

    const previousActiveItemId = this.state.activeItemId;
    const nextItems = this.state.items.filter((item) => item.id !== itemId);
    const nextActiveItemId =
      previousActiveItemId === itemId ? (nextItems[0]?.id ?? null) : previousActiveItemId;

    this.state = {
      items: nextItems,
      activeItemId: nextActiveItemId,
    };

    await this.persistState();

    this.eventBus.emit(
      'workspace:item-removed',
      {
        itemId,
        removedItem: structuredClone(removedItem),
      },
      {
        source: 'workspace',
      },
    );

    if (previousActiveItemId !== nextActiveItemId) {
      this.emitActiveItemChanged(previousActiveItemId, nextActiveItemId);
    }

    this.emitStateChanged();
    return true;
  }

  private buildInitialState(
    seedItems: WorkspaceItem[],
    persisted: WorkspaceState | null,
  ): WorkspaceState {
    if (!persisted) {
      return {
        items: cloneItems(seedItems),
        activeItemId: seedItems[0]?.id ?? null,
      };
    }

    const items = cloneItems(persisted.items);
    const itemIds = new Set(items.map((item) => item.id));

    for (const seedItem of seedItems) {
      if (!itemIds.has(seedItem.id)) {
        items.push(structuredClone(seedItem));
      }
    }

    const activeItemId = items.some((item) => item.id === persisted.activeItemId)
      ? persisted.activeItemId
      : (items[0]?.id ?? null);

    return {
      items,
      activeItemId,
    };
  }

  private ensureHydrated(): void {
    if (!this.hydrated) {
      throw new Error('Workspace manager must be initialized before use.');
    }
  }

  private async persistState(): Promise<void> {
    await this.storage.save(this.storageKey, cloneState(this.state));
  }

  private emitActiveItemChanged(
    previousItemId: string | null,
    currentItemId: string | null,
  ): void {
    this.eventBus.emit<WorkspaceActiveItemChange>(
      'workspace:active-item-changed',
      {
        currentItemId,
        previousItemId,
      },
      {
        source: 'workspace',
      },
    );
  }

  private emitStateChanged(): WorkspaceSnapshot {
    const snapshot = this.getSnapshot();
    this.eventBus.emit('workspace:state-changed', snapshot, {
      source: 'workspace',
    });
    return snapshot;
  }
}
