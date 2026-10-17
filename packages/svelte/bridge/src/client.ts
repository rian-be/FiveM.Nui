import { NuiClient as CoreNuiClient } from '@fivem-nui/core';
import type {
  NuiClientOptions,
  NuiEventKey,
  NuiEventPayload,
  NuiEventRequest,
  NuiEventResponse,
  NuiWindowAction,
  SendPayload
} from '@fivem-nui/core';
import { installGlobalErrorHandlers, type GlobalErrorListenerOptions } from '@fivem-nui/error';

type UntypedNuiClient = Omit<
  InstanceType<typeof CoreNuiClient>,
  'on' | 'once' | 'off' | 'send' | 'sendAndWait' | 'request' | 'callback' | 'onWindow'
> & {
  on(eventName: string, handler: (data: unknown) => void): () => void;
  once(eventName: string, handler: (data: unknown) => void): () => void;
  off(eventName: string, handler?: (data: unknown) => void): void;
  send(eventName: string, payload?: unknown): void;
  sendAndWait(eventName: string, payload?: unknown): Promise<void>;
  request<TResponse = unknown>(
    eventName: string,
    request?: unknown,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<TResponse>;
  callback(
    eventName: string,
    handler: (
      request: unknown
    ) => Promise<{ success: boolean; value?: unknown; error?: { code: string; message: string } }>
  ): void;
  onWindow(handler: (action: string, window: string | undefined) => void): () => void;
};

/**
 * Configuration options for creating a {@link SvelteNuiClient}.
 */
export interface SvelteNuiClientOptions extends Partial<NuiClientOptions> {
  /**
   * Optional pre-configured `@fivem-nui/core` client instance to wrap.
   */
  client?: InstanceType<typeof CoreNuiClient>;

  /**
   * Whether to automatically start listening for window `message` events upon instantiation.
   * @defaultValue true
   */
  autoInitialize?: boolean;

  /**
   * Whether to install global window error & unhandled rejection listeners.
   * If `true`, uses default configuration. You can also pass custom {@link GlobalErrorListenerOptions}.
   * @defaultValue false
   */
  captureGlobalErrors?: boolean | GlobalErrorListenerOptions;
}

/**
 * Svelte NUI Client adapter.
 *
 * Wraps `@fivem-nui/core`'s transport layer with type-safe overloads for contract maps,
 * event listeners, RPC requests, and lifecycle tracking.
 */
export class SvelteNuiClient {
  private readonly _typedClient: InstanceType<typeof CoreNuiClient>;
  private readonly _client: UntypedNuiClient;
  private readonly _listeners = new Set<() => void>();
  private _listening = false;

  /**
   * Creates a new SvelteNuiClient instance.
   *
   * @param options - Configuration options for the client adapter and underlying transport.
   */
  constructor(options: SvelteNuiClientOptions = {}) {
    this._typedClient = options.client ?? new CoreNuiClient(options);
    this._client = this._typedClient as unknown as UntypedNuiClient;

    if (options.autoInitialize !== false) {
      this.listen();
    }

    if (options.captureGlobalErrors) {
      const errorOpts = typeof options.captureGlobalErrors === 'object' ? options.captureGlobalErrors : {};
      const unsubErrors = installGlobalErrorHandlers(errorOpts);
      this._listeners.add(unsubErrors);
    }
  }

  private _ensureListening(): void {
    if (!this._listening) {
      const unsub = this._client.listen();
      this._listeners.add(unsub);
      this._listening = true;
    }
  }

  // --- Subscriptions ---

  /**
   * Subscribes to an event emitted from C# / game backend.
   *
   * @param eventName - Name of the event emitted by C# / game backend.
   * @param handler - Callback function invoked when the event payload arrives.
   * @returns Unsubscribe function to remove the event listener.
   */
  on<K extends NuiEventKey>(eventName: K, handler: (data: NuiEventPayload<K>) => void): () => void;
  on<T = unknown>(eventName: string, handler: (data: T) => void): () => void;
  on(eventName: string, handler: (data: any) => void): () => void {
    this._ensureListening();
    const unsub = this._client.on(eventName, handler);
    this._listeners.add(unsub);
    return () => {
      this._listeners.delete(unsub);
      unsub();
    };
  }

  /**
   * Subscribes to an event once and automatically unsubscribes upon first receipt.
   *
   * @param eventName - Name of the event to listen for once.
   * @param handler - Callback function invoked upon first receipt of the event.
   * @returns Unsubscribe function to remove the one-time listener prior to firing.
   */
  once<K extends NuiEventKey>(eventName: K, handler: (data: NuiEventPayload<K>) => void): () => void;
  once<T = unknown>(eventName: string, handler: (data: T) => void): () => void;
  once(eventName: string, handler: (data: any) => void): () => void {
    this._ensureListening();
    let unsub: () => void;
    const wrappedHandler = (data: any) => {
      this._listeners.delete(unsub);
      handler(data);
    };
    unsub = this._client.once(eventName, wrappedHandler);
    this._listeners.add(unsub);
    return () => {
      this._listeners.delete(unsub);
      unsub();
    };
  }

  /**
   * Removes an event listener.
   *
   * @param eventName - Name of the event to stop listening for.
   * @param handler - Specific handler callback to remove. If omitted, removes all handlers for this event.
   */
  off(eventName: string, handler?: (data: unknown) => void): void {
    this._client.off(eventName, handler);
  }

  // --- Sending ---

  /**
   * Sends a fire-and-forget message to C# via the NUI transport layer.
   *
   * @param eventName - Target event name on the game backend.
   * @param payload - Optional data payload to transmit.
   */
  send<K extends NuiEventKey>(eventName: K, payload?: SendPayload<K>): void;
  send(eventName: string, payload?: unknown): void;
  send(eventName: string, payload?: unknown): void {
    this._ensureListening();
    this._client.send(eventName, payload);
  }

  /**
   * Sends a message to C# and awaits delivery to the transport layer.
   *
   * @param eventName - Target event name on the game backend.
   * @param payload - Optional data payload to transmit.
   * @returns Promise that resolves once the transport layer confirms transmission.
   */
  async sendAndWait<K extends NuiEventKey>(eventName: K, payload?: SendPayload<K>): Promise<void>;
  async sendAndWait(eventName: string, payload?: unknown): Promise<void>;
  async sendAndWait(eventName: string, payload?: unknown): Promise<void> {
    this._ensureListening();
    await this._client.sendAndWait(eventName, payload);
  }

  // --- Requests (UI -> C#) ---

  /**
   * Sends an RPC request to C# and waits for the correlated response envelope.
   *
   * @param eventName - RPC event name on the game backend.
   * @param request - Request payload data.
   * @param timeout - Request timeout in milliseconds.
   * @param signal - AbortSignal to cancel the pending request.
   * @returns Promise resolving to the correlated response payload from C#.
   */
  request<K extends NuiEventKey>(
    eventName: K,
    request?: NuiEventRequest<K>,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<NuiEventResponse<K>>;
  request<TRequest = unknown, TResponse = unknown>(
    eventName: string,
    request?: TRequest,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<TResponse>;
  async request(
    eventName: string,
    request?: unknown,
    timeout?: number,
    signal?: AbortSignal
  ): Promise<unknown> {
    this._ensureListening();
    return this._client.request(eventName, request, timeout, signal);
  }

  // --- Lifecycle Callbacks ---

  /**
   * Sends a notification to a specific native callback endpoint (e.g. `'ready'`, `'close'`).
   *
   * @param callbackName - Name of the native callback endpoint.
   * @param payload - Optional data to send with the notification.
   */
  notify(callbackName: string, payload?: unknown): void {
    this._client.notify(callbackName, payload);
  }

  /**
   * Sends a notification and awaits HTTP transmission confirmation.
   *
   * @param callbackName - Name of the native callback endpoint.
   * @param payload - Optional data to send with the notification.
   * @returns Promise that resolves once the HTTP notification is acknowledged.
   */
  async notifyAndWait(callbackName: string, payload?: unknown): Promise<void> {
    await this._client.notifyAndWait(callbackName, payload);
  }

  /**
   * Registers a handler for requests initiated from C# to the UI.
   *
   * @param eventName - Name of the incoming RPC endpoint from C#.
   * @param handler - Handler function returning a promise with response envelope.
   */
  callback(
    eventName: string,
    handler: (request: unknown) => Promise<{ success: boolean; value?: unknown; error?: { code: string; message: string } }>
  ): void {
    this._ensureListening();
    this._client.callback(eventName, handler);
  }

  /**
   * Unregisters an incoming RPC callback handler previously registered with {@link callback}.
   *
   * @param eventName - Name of the RPC endpoint to unregister.
   * @returns True if a handler was registered and removed, false otherwise.
   */
  unregisterCallback(eventName: string): boolean {
    return this._client.unregisterCallback(eventName);
  }

  // --- Window Lifecycle ---

  /**
   * Listens for window lifecycle actions from C# (`'open'`, `'close'`, `'focus'`, `'blur'`).
   *
   * @param handler - Callback invoked with the lifecycle action and target window identifier.
   * @returns Unsubscribe function to remove the window action listener.
   */
  onWindow(handler: (action: NuiWindowAction, window: string | undefined) => void): () => void {
    this._ensureListening();
    const unsub = this._client.onWindow((action, win) => handler(action as NuiWindowAction, win));
    this._listeners.add(unsub);
    return () => {
      this._listeners.delete(unsub);
      unsub();
    };
  }

  /**
   * Starts listening for NUI message events dispatched to the window.
   *
   * @returns Unsubscribe function to stop listening to window messages.
   */
  listen(): () => void {
    const unsub = this._client.listen();
    this._listeners.add(unsub);
    this._listening = true;
    return unsub;
  }

  /**
   * Returns an untyped view of the underlying transport client.
   *
   * @returns Untyped transport client reference.
   */
  getClient(): UntypedNuiClient {
    return this._client;
  }

  /**
   * Returns the underlying strongly typed `@fivem-nui/core` client instance.
   *
   * @returns The underlying `NuiClient` instance.
   */
  getTypedClient(): InstanceType<typeof CoreNuiClient> {
    return this._typedClient;
  }

  /**
   * Cleans up all active listeners, stops listening, and disposes the underlying transport client.
   */
  destroy(): void {
    for (const unsub of this._listeners) {
      unsub();
    }
    this._listeners.clear();
    this._listening = false;
    this._typedClient.dispose();
  }
}