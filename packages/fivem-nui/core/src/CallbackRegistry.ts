import type { NuiMessage } from './types';

/** Internal storage shape for a registered callback handler. */
export type CallbackHandler = (request: unknown) => Promise<NuiMessage>;

/**
 * Registry for C# request handlers.
 *
 * Stores handlers keyed by event name, providing typ safe registration
 * and O(1) lookup by name. A handler that throws is caught by the caller
 * (via {@link NuiClient.handleRequest}) and reported back to C# as
 * `CALLBACK_ERROR` instead of being left unanswered.
 *
 * Mirrors C# `NuiCallbackRegistry`.
 */
export class CallbackRegistry {
  private callbacks = new Map<string, CallbackHandler>();

  /** Registers (or replaces) a handler for `eventName`. */
  register(eventName: string, handler: CallbackHandler): void {
    this.callbacks.set(eventName, handler);
  }

  /**
   * Removes the handler for `eventName`.
   * @returns `true` if a handler was removed.
   */
  unregister(eventName: string): boolean {
    return this.callbacks.delete(eventName);
  }

  /** Retrieves the handler for `eventName`, or `undefined` if none. */
  get(eventName: string): CallbackHandler | undefined {
    return this.callbacks.get(eventName);
  }

  /** Number of registered callbacks. */
  get count(): number {
    return this.callbacks.size;
  }

  /** Removes every registered callback. Called during `dispose()`. */
  clear(): void {
    this.callbacks.clear();
  }
}
