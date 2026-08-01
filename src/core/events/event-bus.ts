/**
 * Standard event envelope shared across the Cube core engine.
 */
export interface EventMetadata {
  source?: string;
  timestamp: number;
}

export interface EmitMetadata {
  source?: string;
  timestamp?: number;
}

export interface SystemEvent<TPayload = unknown> {
  type: string;
  payload?: TPayload;
  metadata?: EventMetadata;
}

export type EventListener<TPayload = unknown> = (
  event: SystemEvent<TPayload>,
) => void;

/**
 * Lightweight event bus with duplicate listener protection.
 */
export class EventBus {
  private readonly listeners = new Map<string, Set<EventListener>>();

  /**
   * Registers a listener and returns an unsubscribe callback.
   */
  public on<TPayload>(
    eventType: string,
    listener: EventListener<TPayload>,
  ): () => void {
    const bucket = this.listeners.get(eventType) ?? new Set<EventListener>();

    bucket.add(listener as EventListener);
    this.listeners.set(eventType, bucket);

    return () => {
      this.off(eventType, listener);
    };
  }

  /**
   * Removes a listener for a given event type.
   */
  public off<TPayload>(
    eventType: string,
    listener: EventListener<TPayload>,
  ): boolean {
    const bucket = this.listeners.get(eventType);

    if (!bucket) {
      return false;
    }

    const removed = bucket.delete(listener as EventListener);

    if (bucket.size === 0) {
      this.listeners.delete(eventType);
    }

    return removed;
  }

  /**
   * Emits an event to all listeners currently subscribed to its type.
   */
  public emit<TPayload>(
    eventType: string,
    payload?: TPayload,
    metadata?: EmitMetadata,
  ): void {
    const bucket = this.listeners.get(eventType);

    if (!bucket || bucket.size === 0) {
      return;
    }

    const event: SystemEvent<TPayload> = {
      type: eventType,
      payload,
      metadata: {
        timestamp: Date.now(),
        ...metadata,
      },
    };

    for (const listener of [...bucket]) {
      listener(event);
    }
  }

  /**
   * Clears listeners for one event type or for the entire bus.
   */
  public clear(eventType?: string): void {
    if (eventType) {
      this.listeners.delete(eventType);
      return;
    }

    this.listeners.clear();
  }

  /**
   * Returns the number of active listeners.
   */
  public listenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size ?? 0;
    }

    let total = 0;
    for (const bucket of this.listeners.values()) {
      total += bucket.size;
    }

    return total;
  }
}
