import { untrack } from 'svelte';
import type { NuiEventKey, NuiEventRequest, NuiEventResponse } from '@fivem-nui/core';
import {
  globalErrorHandler,
  NuiErrorCategory,
  isAbortError,
  createAbortError,
  type RetryOptions
} from '@fivem-nui/error';
import type { SvelteNuiClient, UntypedNuiClient } from '../client';
import { useNuiClient } from '../context';

export { type RetryOptions };

export enum NuiQueryStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error'
}

export interface NuiQueryOptions<TRequest = unknown, TResponse = unknown> {
  /** Optional client override (defaults to context or global client). */
  client?: SvelteNuiClient;

  /** Request timeout in ms (0 for no timeout). */
  timeout?: number;

  /**
   * Automatic retry configuration using exponential backoff.
   * - `true`: enables default retry (3 attempts for timeout and network errors).
   * - `RetryOptions`: custom retry configuration (maxRetries, delays, filter).
   */
  retry?: boolean | RetryOptions;

  /** Execute automatically on mount. */
  immediate?: boolean;

  /** Initial payload used for immediate fetch or fallback refetch. */
  initialRequest?: TRequest;

  /** Called on successful response. */
  onSuccess?: (data: TResponse) => void;

  /** Called on request failure (except when aborted). */
  onError?: (error: Error) => void;
}

/**
 * Controller for an asynchronous NUI query.
 */
export interface NuiQuery<TRequest, TResponse> {
  readonly status: NuiQueryStatus;
  readonly data: TResponse | null;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly called: boolean;
  readonly lastUpdated: number | null;

  /** Sends the request to C#. Cancels any pending request for this query. */
  execute(request?: TRequest, overrideTimeout?: number): Promise<TResponse>;

  /** Retries the last request using the same payload. */
  refetch(overrideTimeout?: number): Promise<TResponse>;

  /** Cancels the active request and stops loading. */
  abort(): void;

  /** Aborts any pending request and resets data, error, and status to idle. */
  reset(): void;

  /** Cleans up the query and aborts pending requests. */
  destroy(): void;
}

/**
 * Reusable controller managing reactive state and network requests for a NUI query.
 */
export class NuiQueryController<TRequest = unknown, TResponse = unknown> implements NuiQuery<TRequest, TResponse> {
  data = $state<TResponse | null>(null);
  loading = $state(false);
  error = $state<Error | null>(null);
  called = $state(false);
  lastUpdated = $state<number | null>(null);

  private isSuccess = $state(false);
  private lastRequest?: TRequest;
  private hasLastRequest = false;
  private activeRequestId = 0;
  private abortController: AbortController | null = null;
  private isDisposed = false;

  constructor(
    private readonly eventName: string,
    private readonly options: NuiQueryOptions<TRequest, TResponse> = {},
    private readonly client: SvelteNuiClient
  ) {
    this.lastRequest = options.initialRequest;
    this.hasLastRequest = 'initialRequest' in options;
  }

  get status(): NuiQueryStatus {
    if (this.loading) return NuiQueryStatus.Loading;
    if (this.error !== null) return NuiQueryStatus.Error;
    if (this.isSuccess) return NuiQueryStatus.Success;
    return NuiQueryStatus.Idle;
  }

  private async sendRequest(payload: TRequest | undefined, overrideTimeout?: number): Promise<TResponse> {
    if (this.isDisposed) {
      throw new Error('[useNuiQuery] Cannot execute request on a destroyed query controller.');
    }

    if (this.abortController) {
      this.abortController.abort();
    }
    const currentController = new AbortController();
    this.abortController = currentController;
    const currentRequestId = ++this.activeRequestId;

    this.loading = true;
    this.error = null;
    this.called = true;

    const requestFn = (): Promise<TResponse> =>
      (this.client as unknown as UntypedNuiClient).request<TResponse>(
        this.eventName,
        payload,
        overrideTimeout ?? this.options.timeout,
        currentController.signal
      );

    try {
      let result: TResponse;
      if (this.options.retry) {
        const retryConfig: RetryOptions =
          typeof this.options.retry === 'object' ? { ...this.options.retry } : {};

        const userShouldRetry = retryConfig.shouldRetry;
        retryConfig.shouldRetry = (errorInfo) => {
          if (
            currentRequestId !== this.activeRequestId ||
            currentController.signal.aborted ||
            isAbortError(errorInfo.error)
          ) {
            return false;
          }
          if (userShouldRetry) {
            return userShouldRetry(errorInfo);
          }
          return (
            (retryConfig.retryOnTimeout !== false && errorInfo.category === NuiErrorCategory.TIMEOUT) ||
            (retryConfig.retryOnNetworkError !== false && errorInfo.category === NuiErrorCategory.NETWORK)
          );
        };

        result = await globalErrorHandler.retry(requestFn, retryConfig);
      } else {
        result = await requestFn();
      }

      if (currentRequestId !== this.activeRequestId || currentController.signal.aborted) {
        throw createAbortError();
      }

      this.data = result;
      this.isSuccess = true;
      this.lastUpdated = Date.now();

      try {
        this.options.onSuccess?.(result);
      } catch (callbackErr) {
        void globalErrorHandler
          .handle(
            callbackErr instanceof Error ? callbackErr : new Error(String(callbackErr)),
            { event: this.eventName },
            'useNuiQuery:onSuccess'
          )
          .catch(() => {});
        console.error(callbackErr);
      }

      return result;
    } catch (err: unknown) {
      if (currentRequestId !== this.activeRequestId || currentController.signal.aborted) {
        throw isAbortError(err) ? err : createAbortError();
      }

      if (isAbortError(err)) {
        throw err;
      }

      const e = err instanceof Error ? err : new Error(String(err));
      this.error = e;
      this.isSuccess = false;

      void globalErrorHandler
        .handle(e, { event: this.eventName, payload }, 'useNuiQuery:request')
        .catch(() => {});

      try {
        this.options.onError?.(e);
      } catch (callbackErr) {
        void globalErrorHandler
          .handle(
            callbackErr instanceof Error ? callbackErr : new Error(String(callbackErr)),
            { event: this.eventName },
            'useNuiQuery:onError'
          )
          .catch(() => {});
        console.error(callbackErr);
      }
      throw e;
    } finally {
      if (currentRequestId === this.activeRequestId) {
        this.loading = false;
        this.abortController = null;
      }
    }
  }

  execute = async (...args: [request?: TRequest, overrideTimeout?: number]): Promise<TResponse> => {
    const hasExplicitRequest = args.length > 0;
    if (hasExplicitRequest) {
      this.lastRequest = args[0];
      this.hasLastRequest = true;
    }
    return this.sendRequest(this.lastRequest, args[1]);
  };

  refetch = (overrideTimeout?: number): Promise<TResponse> => {
    return this.sendRequest(this.lastRequest, overrideTimeout);
  };

  abort = (): void => {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.activeRequestId++;
    this.loading = false;
  };

  reset = (): void => {
    this.abort();
    this.data = null;
    this.error = null;
    this.isSuccess = false;
    this.called = false;
    this.lastUpdated = null;
    this.lastRequest = this.options.initialRequest;
    this.hasLastRequest = 'initialRequest' in this.options;
  };

  destroy = (): void => {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.abort();
  };
}

/**
 * Reactive query for communicating with C# (`nui.request`).
 * Manages reactive `data`, `loading`, `error`, and `status`.
 *
 * Note: Access properties directly (e.g. `query.data`). Do not destructure, or you'll lose reactivity.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useNuiQuery } from '@fivem-nui/svelte';
 *
 *   const buy = useNuiQuery('shop:buy');
 * </script>
 *
 * <button onclick={() => buy.execute({ id: 'bread', qty: 1 })} disabled={buy.loading}>
 *   {buy.loading ? 'Buying...' : 'Buy'}
 * </button>
 *
 * {#if buy.error}
 *   <p class="error">{buy.error.message}</p>
 * {/if}
 * ```
 */
export function useNuiQuery<K extends NuiEventKey>(
  eventName: K,
  options?: NuiQueryOptions<NuiEventRequest<K>, NuiEventResponse<K>>
): NuiQuery<NuiEventRequest<K>, NuiEventResponse<K>>;

export function useNuiQuery<TRequest = unknown, TResponse = unknown>(
  eventName: string,
  options?: NuiQueryOptions<TRequest, TResponse>
): NuiQuery<TRequest, TResponse>;

export function useNuiQuery<TRequest = unknown, TResponse = unknown>(
  eventName: string,
  options: NuiQueryOptions<TRequest, TResponse> = {}
): NuiQuery<TRequest, TResponse> {
  const client = options.client ?? useNuiClient();
  const query = new NuiQueryController(eventName, options, client);

  $effect(() => () => query.destroy());

  $effect(() => {
    untrack(() => {
      if (options.immediate) {
        void query.execute(options.initialRequest).catch(() => {});
      }
    });
  });

  return query;
}