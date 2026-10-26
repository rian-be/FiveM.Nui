import type { NuiLogger } from './logger';

/** Internal listener type: accepts any payload, callers cast as needed. */
export type EventHandler = (data: unknown) => void;

/**
 * Type safe event subscription and dispatch.
 *
 * Maintains multiple listeners per event name, supports one-shot
 * subscriptions (`once`), and isolates handler errors so a throwing
 * listener cannot prevent its siblings from receiving the payload.
 *
 * Mirrors C# `EventManager`.
 */
export class EventBus {
  private readonly listeners = new Map<string, Set<EventHandler>>();
  private readonly logger: NuiLogger;

  constructor(logger: NuiLogger) {
    this.logger = logger;
  }

  /**
   * Subscribes to `eventName`.
   * @returns an unsubscribe function.
   */
  on<T>(eventName: string, handler: (data: T) => void): () => void {
    let set = this.listeners.get(eventName);

    if (!set) {
      set = new Set();
      this.listeners.set(eventName, set);
    }

    const listener = handler as EventHandler;
    set.add(listener);

    return () => {
      set!.delete(listener);

      if (set!.size === 0 && this.listeners.get(eventName) === set) {
        this.listeners.delete(eventName);
      }
    };
  }

  /**
   * Subscribes to the next occurrence of `eventName` only.
   * @returns an unsubscribe function (also valid after the handler fired).
   */
  once<T>(eventName: string, handler: (data: T) => void): () => void {
    const unsubscribe = this.on<T>(eventName, data => {
      unsubscribe();
      handler(data);
    });

    return unsubscribe;
  }

  /**
   * Unsubscribes from `eventName`.
   * If `handler` is omitted, removes every listener for that event.
   */
  off(eventName: string, handler?: EventHandler): void {
    const set = this.listeners.get(eventName);

    if (!set) {
      return;
    }

    if (handler) {
      set.delete(handler);

      if (set.size === 0 && this.listeners.get(eventName) === set) {
        this.listeners.delete(eventName);
      }
    } else {
      this.listeners.delete(eventName);
    }
  }

  /**
   * Dispatches `payload` to every listener of `eventName`.
   *
   * Copies the listener set first so a handler that unsubscribes itself
   * (or removes a sibling) cannot skip the next listener.
   */
  emit(eventName: string, payload: unknown): void {
    const set = this.listeners.get(eventName);

    if (!set) {
      return;
    }

    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        this.logger.error(`Error in event handler for: ${eventName}`, error);
      }
    }
  }

  /** Total listeners across all events. */
  get listenerCount(): number {
    let total = 0;

    for (const set of this.listeners.values()) {
      total += set.size;
    }

    return total;
  }

  /** Removes every listener. Called during `dispose()`. */
  clear(): void {
    this.listeners.clear();
  }
}
