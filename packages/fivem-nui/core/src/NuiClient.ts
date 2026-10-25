import type { NuiClientOptions } from './NuiClientOptions';
import { readResourceName } from './NuiClientOptions';
import { MessageTransport } from './MessageTransport';
import { RequestCoordinator } from './RequestCoordinator';
import { CallbackRegistry } from './CallbackRegistry';
import { EventBus, type EventHandler } from './EventBus';
import { consoleNuiLogger } from './logger';
import type { NuiLogger } from './logger';
import { NuiErrorCodes, NuiRequestError } from './errors';
import type { NuiDiagnostics } from './diagnostics';
import type {
  NuiEventKey,
  NuiEventMap,
  NuiEventPayload,
  NuiEventRequest,
  NuiEventResponse,
  NuiMessage,
  NuiResult,
  NuiWindowAction,
  SendPayload,
  RequestPayload,
  RequestResponse,
} from './types';

// Re-exported so `import { NuiClientOptions } from '@fivem-nui/core'` keeps working.
export type { NuiClientOptions } from './NuiClientOptions';

const WINDOW_ACTIONS: ReadonlySet<string> = new Set<NuiWindowAction>([
  'open',
  'close',
  'focus',
  'unfocus',
]);

type WindowHandler = (action: NuiWindowAction, window: string | undefined) => void;

/**
 * `NuiClient` is **thin faĂ§ade** it composes four collaborators and
 * orchestrates their interaction:
 *
 * | Collaborator           | Responsibility                         |
 * |------------------------|----------------------------------------|
 * | `MessageTransport`     | Raw HTTP POST to `https://<res>/<cb>`  |
 * | `RequestCoordinator`   | Correlation ID â†” Promise resolution    |
 * | `CallbackRegistry`     | C#-request handler lookup              |
 * | `EventBus`             | C#â†’UI event subscription / dispatch    |
 *
 * Window lifecycle listeners (`onWindow`) and the browser `message`
 * listener (`listen`) stay here because they are browser-integration glue.
 */
export class NuiClient {
  private transport: MessageTransport;
  private requestCoordinator: RequestCoordinator;
  private callbackRegistry: CallbackRegistry;
  private eventBus: EventBus;
  private windowListeners = new Set<WindowHandler>();

  private windowName: string | undefined;
  private requestTimeoutMs: number;
  private logger: NuiLogger;

  private listening = false;
  private disposed = false;
  private stopListening: (() => void) | null = null;

  private counters = {
    sent: 0,
    notified: 0,
    failed: 0,
    received: 0,
    resolved: 0,
    rejected: 0,
  };

  constructor(options: NuiClientOptions = {}) {
    const resource = options.resource ?? readResourceName();
    const callbackName = options.callback ?? 'nui';
    const postTimeoutMs = options.postTimeoutMs ?? 10000;

    this.windowName = options.window;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.logger = options.logger ?? consoleNuiLogger;

    this.transport = new MessageTransport(
      resource,
      callbackName,
      postTimeoutMs,
      this.logger,
      options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
    );
    this.requestCoordinator = new RequestCoordinator();
    this.callbackRegistry = new CallbackRegistry();
    this.eventBus = new EventBus(this.logger);

    this.logger.debug('NuiClient initialized', { resource, callbackName, postTimeoutMs });
  }

  /**
   * Sends a one way message to C#.
   *
   * Fire and forget: the browser reads nothing from the HTTP reply, so there is
   * nothing to await. Use {@link NuiClient.sendAndWait} when delivery matters.
   */
  send<E extends NuiEventKey>(eventName: E, payload: SendPayload<E>): void;
  send<T>(eventName: keyof NuiEventMap extends never ? string : never, payload?: T): void;
  send(eventName: string, payload?: unknown): void {
    if (this.disposed) {
      this.logger.warn(`Cannot send '${eventName}' after dispose`);
      return;
    }

    const message: NuiMessage = {
      type: 'event',
      event: eventName,
      payload,
    };

    void this.sendMessage(message).catch((error: unknown) => {
      this.counters.failed += 1;
      this.logger.error(`Failed to send event ${eventName}`, error);
    });
  }

  /**
   * Sends a message to C# on the main callback and waits for the POST to land.
   *
   * Rejects with {@link NuiRequestError} on timeout or when the resource stops
   * answering. This is delivery confirmation only, not a C# acknowledgement.
   */
  sendAndWait<E extends NuiEventKey>(eventName: E, payload: SendPayload<E>): Promise<void>;
  sendAndWait<T>(eventName: keyof NuiEventMap extends never ? string : never, payload?: T): Promise<void>;
  async sendAndWait(eventName: string, payload?: unknown): Promise<void> {
    if (this.disposed) {
      throw new NuiRequestError(NuiErrorCodes.Disposed, 'Client was disposed');
    }

    await this.sendMessage({ type: 'event', event: eventName, payload });
  }

  /**
   * Sends a request and waits for a response.
   *
   * Rejects with a {@link NuiRequestError} whose `code` distinguishes a C#
   * failure from a timeout, so callers do not have to match on message text.
   * Pass an {@link AbortSignal} to cancel waiting for this request alone,
   * without disposing the client; a late response is then dropped.
   */
  request<E extends NuiEventKey>(
    eventName: E,
    request: RequestPayload<E>,
    timeout?: number,
    signal?: AbortSignal,
  ): Promise<RequestResponse<E>>;
  request<TRequest, TResponse>(
    eventName: keyof NuiEventMap extends never ? string : never,
    request?: TRequest,
    timeout?: number,
    signal?: AbortSignal,
  ): Promise<TResponse>;
  async request(
    eventName: string,
    request?: unknown,
    timeout = this.requestTimeoutMs,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (this.disposed) {
      throw new NuiRequestError(NuiErrorCodes.Disposed, 'Client was disposed');
    }

    if (signal?.aborted) {
      throw new NuiRequestError(
        NuiErrorCodes.Aborted,
        `Request for ${eventName} was aborted before it was sent`,
      );
    }

    const correlationId = RequestCoordinator.generateCorrelationId();
    const message: NuiMessage = {
      id: correlationId,
      type: 'request',
      event: eventName,
      payload: request,
    };

    return new Promise<unknown>((resolve, reject) => {
      const onAbort = () => {
        this.requestCoordinator.unregister(correlationId);
        this.counters.rejected += 1;
        reject(
          new NuiRequestError(
            NuiErrorCodes.Aborted,
            `Request for ${eventName} was aborted`,
          ),
        );
      };

      const timeoutId = globalThis.setTimeout(() => {
        this.requestCoordinator.unregister(correlationId);
        this.counters.rejected += 1;
        reject(
          new NuiRequestError(
            NuiErrorCodes.Timeout,
            `No response for ${eventName} after ${timeout}ms`,
          ),
        );
      }, timeout);

      signal?.addEventListener('abort', onAbort, { once: true });

      this.requestCoordinator.register(
        correlationId,
        value => {
          this.counters.resolved += 1;
          resolve(value);
        },
        error => {
          this.counters.rejected += 1;
          reject(error);
        },
        timeoutId,
        () => signal?.removeEventListener('abort', onAbort),
      );

      void this.sendMessage(message).catch((error: unknown) => {
        this.requestCoordinator.unregister(correlationId);
        this.counters.failed += 1;
        reject(
          error instanceof NuiRequestError
            ? error
            : new NuiRequestError(NuiErrorCodes.Transport, String(error)),
        );
      });
    });
  }

  /**
   * Posts an envelope to a separate resource callback, bypassing the main one.
   * Useful for lifecycle signals (e.g. `ready`, `close`) that C# handles on
   * their own callbacks.
   *
   * Fire-and-forget by design: the browser reads nothing from the HTTP reply,
   * and awaiting it would stall the page for the full post timeout. Use
   * {@link NuiClient.notifyAndWait} when you genuinely need to know it arrived.
   */
  notify(callbackName: string, payload?: unknown): void {
    if (this.disposed) {
      this.logger.warn(`Cannot notify '${callbackName}' after dispose`);
      return;
    }

    this.counters.notified += 1;

    void this.transport.post(this.transport.callbackUrl(callbackName), payload ?? {}).catch(
      (error: unknown) => {
        this.counters.failed += 1;
        this.logger.warn(`Could not deliver '${callbackName}'`, error);
      },
    );
  }

  /**
   * Same as {@link NuiClient.notify} but resolves only once the resource has
   * answered, or rejects on timeout. Used for the initial handshake, where a
   * silent failure would leave the UI permanently dead.
   */
  async notifyAndWait(callbackName: string, payload?: unknown): Promise<void> {
    if (this.disposed) {
      throw new NuiRequestError(NuiErrorCodes.Disposed, 'Client was disposed');
    }

    this.counters.notified += 1;

    try {
      await this.transport.post(this.transport.callbackUrl(callbackName), payload ?? {});
    } catch (error) {
      this.counters.failed += 1;
      throw error;
    }
  }

  // Callback server (C# → UI requests)
  /**
   * Registers a callback handler for C# requests.
   *
   * A handler that throws is reported back to C# as `CALLBACK_ERROR` instead of
   * leaving the request unanswered until it times out.
   */
  callback<E extends NuiEventKey>(
    eventName: E,
    handler: (request: NuiEventRequest<E>) => Promise<NuiResult<NuiEventResponse<E>>>,
  ): void;
  callback<TRequest, TResponse>(
    eventName: keyof NuiEventMap extends never ? string : never,
    handler: (request: TRequest) => Promise<NuiResult<TResponse>>,
  ): void;
  callback(
    eventName: string,
    handler: (request: unknown) => Promise<NuiResult<unknown>>,
  ): void {
    if (this.disposed) {
      this.logger.warn(`Cannot register callback '${eventName}' after dispose`);
      return;
    }

    this.callbackRegistry.register(
      eventName,
      async (request: unknown): Promise<NuiMessage> => {
        try {
          const result = await handler(request);

          return {
            type: 'response',
            success: result.success,
            payload: result.value,
            error: result.error,
          };
        } catch (error) {
          this.logger.error(`Callback '${eventName}' threw`, error);

          return {
            type: 'response',
            success: false,
            error: {
              code: NuiErrorCodes.CallbackError,
              message: error instanceof Error ? error.message : 'Unknown error',
            },
          };
        }
      },
    );
  }

  /**
   * Removes a handler registered with {@link NuiClient.callback}.
   *
   * Lets C# be told `UNKNOWN_CALLBACK` again instead of hitting a handler the
   * page no longer owns.
   */
  unregisterCallback(eventName: string): boolean {
    return this.callbackRegistry.unregister(eventName);
  }

  /**
   * Subscribes to C# events.
   *
   * @returns unsubscribe function.
   */
  on<E extends NuiEventKey>(eventName: E, handler: (data: NuiEventPayload<E>) => void): () => void;
  on<T>(eventName: keyof NuiEventMap extends never ? string : never, handler: (data: T) => void): () => void;
  on(eventName: string, handler: (data: unknown) => void): () => void {
    if (this.disposed) {
      return () => { };
    }

    return this.eventBus.on(eventName, handler);
  }

  /**
   * Subscribes to the next occurrence of a C# event only.
   */
  once<E extends NuiEventKey>(eventName: E, handler: (data: NuiEventPayload<E>) => void): () => void;
  once<T>(eventName: keyof NuiEventMap extends never ? string : never, handler: (data: T) => void): () => void;
  once(eventName: string, handler: (data: unknown) => void): () => void {
    if (this.disposed) {
      return () => { };
    }

    return this.eventBus.once(eventName, handler);
  }

  /**
   * Unsubscribes from C# events.
   */
  off(eventName: string, handler?: EventHandler): void {
    this.eventBus.off(eventName, handler);
  }

  /**
   * Subscribes to window lifecycle envelopes from C#.
   *
   * @param handler receives the action and the window name it applies to.
   * @returns unsubscribe function.
   */
  onWindow(handler: WindowHandler): () => void {
    if (this.disposed) {
      return () => { };
    }

    this.windowListeners.add(handler);

    return () => {
      this.windowListeners.delete(handler);
    };
  }

  /**
   * Routes an incoming message from C#. Pass `MessageEvent.data` here;
   * `listen()` does that for you.
   */
  handleMessage(message: NuiMessage): void {
    if (this.disposed) {
      this.logger.debug('Ignoring message received after dispose');
      return;
    }

    this.counters.received += 1;

    switch (message.type) {
      case 'request':
        void this.handleRequest(message);
        break;
      case 'response':
        this.handleResponse(message);
        break;
      case 'event':
        this.handleEvent(message);
        break;
      default:
        if (WINDOW_ACTIONS.has(message.type)) {
          this.handleWindow(message.type as NuiWindowAction, message.event);
        } else {
          this.logger.debug('Ignoring message of type:', message.type);
        }
        break;
    }
  }

  /**
   * Subscribes to C# messages posted to the page. Idempotent.
   */
  listen(target: Window = window): () => void {
    if (this.listening) {
      return () => { };
    }

    this.listening = true;

    const listener = (event: MessageEvent) => {
      const raw = event.data;

      let message: NuiMessage;
      try {
        message = typeof raw === 'string' ? (JSON.parse(raw) as NuiMessage) : (raw as NuiMessage);
      } catch (error) {
        this.logger.warn('Ignoring malformed NUI message', error);
        return;
      }

      this.handleMessage(message);
    };

    target.addEventListener('message', listener as EventListener);

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      target.removeEventListener('message', listener as EventListener);
      if (this.stopListening === stop) {
        this.listening = false;
        this.stopListening = null;
      }
    };
    this.stopListening = stop;

    return stop;
  }

  /** Handles incoming requests from C#. */
  private async handleRequest(message: NuiMessage): Promise<void> {
    if (!message.id) {
      this.logger.warn('Received request without correlation ID');
      return;
    }

    const callback = message.event
      ? this.callbackRegistry.get(message.event)
      : undefined;

    if (!callback) {
      this.logger.warn(`No callback registered for event: ${message.event}`);
      await this.trySend({
        id: message.id,
        type: 'response',
        success: false,
        error: {
          code: NuiErrorCodes.UnknownCallback,
          message: `No handler for ${message.event}`,
        },
      });
      return;
    }

    try {
      const response = await callback(message.payload);
      response.id = message.id;
      await this.trySend(response);
    } catch (error) {
      this.logger.error(`Error executing callback for event: ${message.event}`, error);

      // The resource may be stopping, which makes every fetch fail. Reporting
      // that must not throw again and escape as an unhandled rejection.
      await this.trySend({
        id: message.id,
        type: 'response',
        success: false,
        error: {
          code: NuiErrorCodes.CallbackError,
          message: 'An error occurred processing the request',
        },
      });
    }
  }

  /** Handles incoming responses to our `request()` calls. */
  private handleResponse(message: NuiMessage): void {
    if (!message.id) {
      this.logger.warn('Received response without correlation ID');
      return;
    }

    if (message.success) {
      if (!this.requestCoordinator.resolve(message.id, message.payload)) {
        // A response whose request already timed out, or one the C# side
        // stamped incorrectly - expected during churn, not worth a warning.
        this.logger.debug(`Response for untracked request ${message.id}`);
      }
    } else {
      if (
        !this.requestCoordinator.reject(
          message.id,
          NuiRequestError.fromEnvelope(message.error),
        )
      ) {
        this.logger.debug(`Response for untracked request ${message.id}`);
      }
    }
  }

  /** Handles incoming events from C#. */
  private handleEvent(message: NuiMessage): void {
    if (!message.event) {
      return;
    }

    this.eventBus.emit(message.event, message.payload);
  }

  /** Dispatches window lifecycle envelopes, filtered to the configured window. */
  private handleWindow(action: NuiWindowAction, window: string | undefined): void {
    if (this.windowName !== undefined && window !== this.windowName) {
      return;
    }

    for (const handler of this.windowListeners) {
      try {
        handler(action, window);
      } catch (error) {
        this.logger.error(`Window handler failed for '${action}'`, error);
      }
    }
  }

  /**
   * POSTs an envelope to the main callback, incrementing the `sent` counter.
   * Reused by `send`, `sendAndWait` and `request`.
   */
  private async sendMessage(message: NuiMessage): Promise<void> {
    this.counters.sent += 1;
    await this.transport.post(this.transport.mainCallbackUrl, message);
  }

  /** Fire and forget delivery that swallows errors (used for callback responses). */
  private async trySend(message: NuiMessage): Promise<void> {
    try {
      await this.sendMessage(message);
    } catch (error) {
      this.counters.failed += 1;
      this.logger.warn('Could not deliver response', error);
    }
  }

  /** Current counters. Cheap enough to call from a diagnostics panel. */
  getDiagnostics(): NuiDiagnostics {
    return {
      ...this.counters,
      pending: this.requestCoordinator.pendingCount,
      listeners: this.eventBus.listenerCount,
      callbacks: this.callbackRegistry.count,
      windowListeners: this.windowListeners.size,
    };
  }

  /**
   * Drops every listener, callback and pending request, and stops listening.
   *
   * Use it when the page is torn down (Svelte remount, HMR) so a stale
   * `NuiClient` cannot keep responding to C# on behalf of a dead page.
   */
  dispose(): void {
    this.disposed = true;
    this.stopListening?.();
    this.eventBus.clear();
    this.callbackRegistry.clear();
    this.windowListeners.clear();

    this.requestCoordinator.rejectAll(
      new NuiRequestError(NuiErrorCodes.Disposed, 'Client was disposed'),
    );
  }

  /** True after {@link NuiClient.dispose}. */
  isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * Global instance bound to the ambient FiveM resource.
 */
export const nui = new NuiClient();
