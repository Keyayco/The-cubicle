import { CubeError } from '../errors/cube-error';
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWorkspaceItem = (value: unknown): value is WorkspaceItem => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    value.id.trim() === value.id &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.description === 'string' &&
    (value.kind === 'system' || value.kind === 'plugin')
  );
};

const cloneItem = (item: WorkspaceItem): WorkspaceItem => ({ ...item });

const cloneItems = (items: readonly WorkspaceItem[]): WorkspaceItem[] =>
  items.map(cloneItem);

const cloneState = (state: WorkspaceState): WorkspaceState => ({
  items: cloneItems(state.items),
  activeItemId: state.activeItemId,
});

const validateItem = (value: unknown): WorkspaceItem => {
  if (!isWorkspaceItem(value)) {
    throw new CubeError('Workspace item is invalid.', {
      code: 'WORKSPACE_ITEM_INVALID',
      details: { itemId: isRecord(value) ? value.id : undefined },
    });
  }

  return cloneItem(value);
};

const validateItems = (
  items: readonly WorkspaceItem[],
): WorkspaceItem[] => {
  const validatedItems = items.map(validateItem);
  const itemIds = new Set<string>();

  for (const item of validatedItems) {
    if (itemIds.has(item.id)) {
      throw new CubeError(`Workspace item "${item.id}" is duplicated.`, {
        code: 'WORKSPACE_ITEM_ALREADY_REGISTERED',
        details: { itemId: item.id },
      });
    }

    itemIds.add(item.id);
  }

  return validatedItems;
};

const isWorkspaceState = (value: unknown): value is WorkspaceState => {
  if (
    !isRecord(value) ||
    !Array.isArray(value.items) ||
    !(typeof value.activeItemId === 'string' || value.activeItemId === null)
  ) {
    return false;
  }

  const itemIds = new Set<string>();
  for (const item of value.items) {
    if (!isWorkspaceItem(item) || itemIds.has(item.id)) {
      return false;
    }

    itemIds.add(item.id);
  }

  return true;
};

/**
 * Manages persisted system/plugin workspace items and the active item.
 */
export class WorkspaceManager {
  private state: WorkspaceState = {
    items: [],
    activeItemId: null,
  };

  private hydrated = false;

  private initialization?: Promise<WorkspaceSnapshot>;

  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly eventBus: EventBus,
    private readonly storage: StorageService,
    private readonly storageKey: string = WORKSPACE_STORAGE_KEY,
  ) {}

  /**
   * Hydrates saved state and adds any missing system/plugin seed items.
   */
  public initialize(
    seedItems: readonly WorkspaceItem[] = [],
  ): Promise<WorkspaceSnapshot> {
    if (this.hydrated) {
      return Promise.resolve(this.getSnapshot());
    }

    if (this.initialization) {
      return this.initialization;
    }

    this.initialization = this.hydrate(seedItems).finally(() => {
      this.initialization = undefined;
    });

    return this.initialization;
  }

  /**
   * Returns whether saved state has been loaded.
   */
  public isHydrated(): boolean {
    return this.hydrated;
  }

  /**
   * Returns an isolated snapshot of the workspace state.
   */
  public getSnapshot(): WorkspaceSnapshot {
    return {
      ...cloneState(this.state),
      hydrated: this.hydrated,
    };
  }

  /**
   * Lists the registered workspace items.
   */
  public listItems(): WorkspaceItem[] {
    return cloneItems(this.state.items);
  }

  /**
   * Returns the active item, or null when no item is active.
   */
  public getActiveItem(): WorkspaceItem | null {
    const activeItem = this.state.items.find(
      (item) => item.id === this.state.activeItemId,
    );

    return activeItem ? cloneItem(activeItem) : null;
  }

  /**
   * Registers an item and activates it when requested or when none is active.
   */
  public registerItem(
    item: WorkspaceItem,
    options?: { activate?: boolean },
  ): Promise<WorkspaceSnapshot> {
    return this.enqueueMutation(async () => {
      this.ensureHydrated();
      const nextItem = validateItem(item);

      if (this.state.items.some((existingItem) => existingItem.id === nextItem.id)) {
        throw new CubeError(
          `Workspace item "${nextItem.id}" is already registered.`,
          {
            code: 'WORKSPACE_ITEM_ALREADY_REGISTERED',
            details: { itemId: nextItem.id },
          },
        );
      }

      const previousActiveItemId = this.state.activeItemId;
      const nextActiveItemId =
        options?.activate === true || previousActiveItemId === null
          ? nextItem.id
          : previousActiveItemId;
      const nextState: WorkspaceState = {
        items: [...this.state.items, nextItem],
        activeItemId: nextActiveItemId,
      };

      await this.persistState(nextState);
      this.state = nextState;
      this.eventBus.emit('workspace:item-registered', cloneItem(nextItem), {
        source: 'workspace-manager',
      });

      if (previousActiveItemId !== nextActiveItemId) {
        this.emitActiveItemChanged(previousActiveItemId, nextActiveItemId);
      }

      return this.emitStateChanged();
    });
  }

  /**
   * Activates an existing item by identifier.
   */
  public activateItem(itemId: string): Promise<WorkspaceSnapshot> {
    return this.enqueueMutation(async () => {
      this.ensureHydrated();
      const targetItem = this.state.items.find((item) => item.id === itemId);

      if (!targetItem) {
        throw new CubeError(`Workspace item "${itemId}" is not registered.`, {
          code: 'WORKSPACE_ITEM_NOT_FOUND',
          details: { itemId },
        });
      }

      const previousActiveItemId = this.state.activeItemId;
      if (previousActiveItemId === itemId) {
        return this.getSnapshot();
      }

      const nextState: WorkspaceState = {
        ...this.state,
        activeItemId: itemId,
      };

      await this.persistState(nextState);
      this.state = nextState;
      this.emitActiveItemChanged(previousActiveItemId, itemId);
      return this.emitStateChanged();
    });
  }

  /**
   * Removes an item. Removing the active item selects the first remaining item.
   */
  public removeItem(itemId: string): Promise<boolean> {
    return this.enqueueMutation(async () => {
      this.ensureHydrated();
      const removedItem = this.state.items.find((item) => item.id === itemId);

      if (!removedItem) {
        return false;
      }

      const previousActiveItemId = this.state.activeItemId;
      const nextItems = this.state.items.filter((item) => item.id !== itemId);
      const nextActiveItemId =
        previousActiveItemId === itemId
          ? (nextItems[0]?.id ?? null)
          : previousActiveItemId;
      const nextState: WorkspaceState = {
        items: nextItems,
        activeItemId: nextActiveItemId,
      };

      await this.persistState(nextState);
      this.state = nextState;
      this.eventBus.emit(
        'workspace:item-removed',
        {
          itemId,
          removedItem: cloneItem(removedItem),
        },
        { source: 'workspace-manager' },
      );

      if (previousActiveItemId !== nextActiveItemId) {
        this.emitActiveItemChanged(previousActiveItemId, nextActiveItemId);
      }

      this.emitStateChanged();
      return true;
    });
  }

  private async hydrate(
    seedItems: readonly WorkspaceItem[],
  ): Promise<WorkspaceSnapshot> {
    const validatedSeeds = validateItems(seedItems);
    const persisted = await this.storage.read<unknown>(this.storageKey);

    if (persisted !== null && !isWorkspaceState(persisted)) {
      throw new CubeError('Persisted workspace state is invalid.', {
        code: 'WORKSPACE_STATE_INVALID',
      });
    }

    const nextState = this.buildInitialState(validatedSeeds, persisted);
    await this.persistState(nextState);
    this.state = nextState;
    this.hydrated = true;

    const snapshot = this.getSnapshot();
    this.eventBus.emit('workspace:initialized', snapshot, {
      source: 'workspace-manager',
    });
    this.emitStateChanged();
    return snapshot;
  }

  private buildInitialState(
    seedItems: readonly WorkspaceItem[],
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
        items.push(cloneItem(seedItem));
        itemIds.add(seedItem.id);
      }
    }

    const activeItemId = items.some(
      (item) => item.id === persisted.activeItemId,
    )
      ? persisted.activeItemId
      : (items[0]?.id ?? null);

    return { items, activeItemId };
  }

  private ensureHydrated(): void {
    if (!this.hydrated) {
      throw new CubeError('Workspace manager must be initialized first.', {
        code: 'WORKSPACE_MANAGER_NOT_INITIALIZED',
      });
    }
  }

  private persistState(state: WorkspaceState): Promise<void> {
    return this.storage.save(this.storageKey, cloneState(state));
  }

  private emitActiveItemChanged(
    previousItemId: string | null,
    currentItemId: string | null,
  ): void {
    this.eventBus.emit<WorkspaceActiveItemChange>(
      'workspace:active-item-changed',
      { currentItemId, previousItemId },
      { source: 'workspace-manager' },
    );
  }

  private emitStateChanged(): WorkspaceSnapshot {
    const snapshot = this.getSnapshot();
    this.eventBus.emit('workspace:state-changed', snapshot, {
      source: 'workspace-manager',
    });
    return snapshot;
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
