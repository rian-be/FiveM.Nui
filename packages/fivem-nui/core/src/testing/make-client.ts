import { NuiClient } from '../NuiClient';
import { nullNuiLogger } from '../logger';
import type { NuiMessage, NuiResult } from '../types';
import { fakeFetch, type CapturedPost, type FakeFetch } from './fake-fetch';

/** One message the client sent, with the URL it was posted to. */
export type SentMessage = CapturedPost;

/**
 * Handles a request coming from C#. May return an {@link NuiResult}-like
 * object (`{ success, value, error }`) or a plain value, which is wrapped in
 * a success result for you.
 */
export type CallbackHandler<TRequest = unknown, TResponse = unknown> = (
  request: TRequest
) => NuiResult<TResponse> | Promise<NuiResult<TResponse>> | TResponse | Promise<TResponse>;

/** Handlers registered up front, keyed by event name. */
export type CallbackMap = Record<string, CallbackHandler>;

/** Options accepted by {@link createTestNuiClient}. */
export interface TestClientOptions {
  /** Resource name used to build the POST URL. Defaults to `test_resource`. */
  resource?: string;
  /** Envelope callback name. Defaults to `nui`. */
  callback?: string;
  /** Callbacks registered before the first request arrives. */
  callbacks?: CallbackMap;
  /** How long a fake resource takes to answer, in ms. */
  postTimeoutMs?: number;
  logger?: typeof nullNuiLogger;
}

/** A `NuiClient` bound to captured traffic, plus the helpers tests need. */
export interface TestNuiClient {
  /** The client under test. Nothing it sends leaves the page. */
  client: NuiClient;
  /** Recorded traffic and the `hang` / `release` controls. */
  transport: FakeFetch;
  /** Simulate C# pushing an event to the UI. */
  emit(eventName: string, payload?: unknown): void;
  /** Simulate C# sending a request to the UI and await the UI's response. */
  simulateRequest<TResponse = unknown>(
    requestId: string,
    eventName: string,
    payload?: unknown
  ): Promise<TResponse>;
  /** Answer a request opened by {@link simulateRequest}. */
  deliverResponse(
    requestId: string,
    success: boolean,
    value?: unknown,
    error?: { code: string; message: string }
  ): void;
  /** Register a handler for a C# -> UI request. */
  addCallback(eventName: string, handler: CallbackHandler): void;
  /** Every message the client has sent, in order. */
  getSentMessages(): SentMessage[];
  /** Forget every recorded message. */
  clearSentMessages(): void;
  /** Release listeners, callbacks and pending requests. */
  dispose(): void;
}

/**
 * Test helpers address events by raw string, so they bypass the event-map
 * generics that `NuiClient`'s public API enforces.
 */
function untyped(client: NuiClient): {
  callback(eventName: string, handler: (request: unknown) => Promise<unknown>): void;
} {
  return client as unknown as {
    callback(eventName: string, handler: (request: unknown) => Promise<unknown>): void;
  };
}

/**
 * Creates a {@link NuiClient} wired to captured traffic, plus helpers for
 * driving the C# side of the bridge.
 *
 * The client posts into memory rather than over the network, so a test can
 * inspect what was sent and control when the resource answers. Nothing is
 * sent, which means no FiveM server has to be running.
 *
 * @example
 * ```ts
 * const testNui = createTestNuiClient({
 *   callbacks: {
 *     'character:get': async ({ characterId }) => ({
 *       success: true,
 *       value: { id: characterId, name: 'John Doe' },
 *     }),
 *   },
 * });
 *
 * // Simulate C# sending an event to the UI
 * testNui.emit('inventory:updated', { items: [{ id: 'water', count: 3 }] });
 * ```
 *
 * See `docs/testing.md` for usage examples.
 */
export function createTestNuiClient(options: TestClientOptions = {}): TestNuiClient {
  const transport = fakeFetch();

  const client = new NuiClient({
    resource: options.resource ?? 'test_resource',
    callback: options.callback ?? 'nui',
    logger: options.logger ?? nullNuiLogger,
    fetch: transport.impl,
  });

  const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();

  /** Normalises whatever a handler returned into an NuiResult shape. */
  const toResult = (result: unknown): NuiResult<unknown> => {
    const candidate = result as NuiResult<unknown>;

    if (typeof candidate === 'object' && candidate !== null && 'success' in candidate) {
      return {
        success: candidate.success,
        value: candidate.value,
        error: candidate.error,
      };
    }

    // Plain value - wrap it in a success result.
    return { success: true, value: result };
  };

  const addCallback = (eventName: string, handler: CallbackHandler): void => {
    // Thrown errors are deliberately left to propagate: the client's callback
    // registry turns them into a CALLBACK_ERROR response, which is exactly
    // what production does.
    untyped(client).callback(eventName, async (request: unknown) =>
      toResult(await handler(request))
    );
  };

  for (const [eventName, handler] of Object.entries(options.callbacks ?? {})) {
    addCallback(eventName, handler);
  }

  return {
    client,
    transport,

    emit(eventName: string, payload?: unknown): void {
      const message: NuiMessage = { type: 'event', event: eventName, payload };
      client.handleMessage(message);
    },

    simulateRequest<TResponse = unknown>(
      requestId: string,
      eventName: string,
      payload?: unknown
    ): Promise<TResponse> {
      const promise = new Promise<TResponse>((resolve, reject) => {
        pendingRequests.set(requestId, {
          resolve: value => resolve(value as TResponse),
          reject
        });
      });

      client.handleMessage({
        id: requestId,
        type: 'request',
        event: eventName,
        payload,
      });

      return promise;
    },

    deliverResponse(
      requestId: string,
      success: boolean,
      value?: unknown,
      error?: { code: string; message: string }
    ): void {
      const pending = pendingRequests.get(requestId);

      if (!pending) {
        return;
      }

      pendingRequests.delete(requestId);
      client.handleMessage({
        id: requestId,
        type: 'response',
        success,
        payload: value,
        error,
      });
      pending.resolve(value);
    },

    addCallback,

    getSentMessages(): SentMessage[] {
      return transport.posts;
    },

    clearSentMessages(): void {
      transport.posts.length = 0;
    },

    dispose(): void {
      pendingRequests.clear();
      client.dispose();
    }
  };
}