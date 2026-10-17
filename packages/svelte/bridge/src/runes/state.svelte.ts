import { onDestroy } from 'svelte';
import type { NuiEventKey, NuiEventPayload } from '@fivem-nui/core';
import { globalErrorHandler } from '@fivem-nui/error';
import type { SvelteNuiClient } from '../client';
import { useNuiClient } from '../context';

export interface NuiStateOptions<T> {
  /** Optional client override (defaults to context or global client). */
  client?: SvelteNuiClient;

  /** Transform or validate raw incoming payload before updating state. */
  transform?: (raw: unknown) => T;

  /** Called when payload handling or transform fails. */
  onError?: (error: Error) => void;

  /**
   * Automatic cleanup on component unmount.
   * - `false`: disables lifecycle hook (useful for global stores / singletons).
   * - `true`: strictly requires component context (throws if called outside).
   * - `undefined`: automatically hooks into component lifecycle if available.
   */
  autoDestroy?: boolean;
}

/**
 * Controller for reactive state synchronized with a NUI event.
 */
export interface NuiState<T> {
  /** Current value. */
  value: T;

  /** Timestamp (epoch ms) of the last received event, or null. */
  readonly updatedAt: number | null;

  /** Number of received events. */
  readonly count: number;

  /** Last processing or transform error, or null. */
  readonly error: Error | null;

  /** Sets the value manually without incrementing count or updatedAt. */
  set(value: T): void;

  /** Updates the value using an updater function. */
  update(fn: (prev: T) => T): void;

  /** Resets state back to the initial value and clears errors. */
  reset(): void;

  /** Unsubscribes from the event. */
  destroy(): void;
}

/**
 * Binds a FiveM NUI event to reactive state.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useNuiState } from '@fivem-nui/svelte';
 *
 *   const player = useNuiState('player:update', { health: 100, armor: 0 });
 * </script>
 *
 * <div>Health: {player.value.health}</div>
 * ```
 */
/**
 * Controller managing reactive state synchronized with a NUI event.
 */
export class NuiStateController<T> implements NuiState<T> {
  value = $state<T>(undefined as unknown as T);
  updatedAt = $state<number | null>(null);
  count = $state(0);
  error = $state<Error | null>(null);

  private readonly initialValue: T;
  private isDestroyed = false;
  private readonly unsubscribe: () => void;

  constructor(
    eventName: string,
    initialValue: T,
    options: NuiStateOptions<T> = {},
    client: SvelteNuiClient
  ) {
    this.initialValue = initialValue;
    this.value = initialValue;

    this.unsubscribe = client.on(eventName, (data: unknown) => {
      try {
        this.value = options.transform ? options.transform(data) : (data as T);
        this.updatedAt = Date.now();
        this.count += 1;
        this.error = null;
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        this.error = e;
        void globalErrorHandler
          .handle(e, { event: eventName, payload: data }, 'useNuiState:transform')
          .catch(() => {});
        try {
          options.onError?.(e);
        } catch (callbackErr) {
          void globalErrorHandler
            .handle(
              callbackErr instanceof Error ? callbackErr : new Error(String(callbackErr)),
              { event: eventName },
              'useNuiState:onError'
            )
            .catch(() => {});
          console.error(callbackErr);
        }
      }
    });
  }

  set = (v: T): void => {
    this.value = v;
  };

  update = (fn: (prev: T) => T): void => {
    this.value = fn(this.value);
  };

  reset = (): void => {
    this.value = this.initialValue;
    this.updatedAt = null;
    this.count = 0;
    this.error = null;
  };

  destroy = (): void => {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.unsubscribe();
  };
}

export function useNuiState<K extends NuiEventKey>(
  eventName: K,
  initialValue: NuiEventPayload<K>,
  options?: NuiStateOptions<NuiEventPayload<K>>
): NuiState<NuiEventPayload<K>>;
export function useNuiState<T>(
  eventName: string,
  initialValue: T,
  options?: NuiStateOptions<T>
): NuiState<T>;
export function useNuiState<T>(
  eventName: string,
  initialValue: T,
  options: NuiStateOptions<T> = {}
): NuiState<T> {
  const client = options.client ?? useNuiClient();
  const state = new NuiStateController(eventName, initialValue, options, client);

  if (options.autoDestroy === true) {
    try {
      onDestroy(state.destroy);
    } catch (err) {
      state.destroy();
      throw err;
    }
  } else if (options.autoDestroy !== false) {
    try {
      onDestroy(state.destroy);
    } catch {
      // Called outside a component lifecycle; cleanup must be managed manually via destroy().
    }
  }

  return state;
}