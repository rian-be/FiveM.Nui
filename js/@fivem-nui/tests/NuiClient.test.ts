import { describe, expect, it, vi } from 'vitest';
import { NuiClient } from '../src/NuiClient';
import { MessageTransport } from '../src/MessageTransport';
import { NuiErrorCodes, NuiRequestError, isNuiRequestError } from '../src/errors';
import { nullNuiLogger } from '../src/logger';
import type { NuiMessage } from '../src/types';

interface Post {
  url: string;
  body: NuiMessage;
}

/**
 * Collects POSTs instead of sending them, and lets a test decide when (and
 * whether) the resource answers.
 *
 * The hang path honours `AbortSignal`, because that is the only way the client
 * can ever give up on a POST - a fake that ignored it would hang forever.
 */
function fakeFetch() {
  const posts: Post[] = [];
  let hang = false;

  const impl = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        posts.push({
          url: String(input),
          body: JSON.parse(String(init?.body)) as NuiMessage,
        });

        if (!hang) {
          resolve(new Response('{}', { status: 200 }));
          return;
        }

        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        );
      }),
  );

  return {
    impl: impl as unknown as typeof fetch,
    posts,
    hang: () => {
      hang = true;
    },
    release: () => {
      hang = false;
    },
    last: () => posts[posts.length - 1],
  };
}

function makeClient(overrides: Partial<ConstructorParameters<typeof NuiClient>[0]> = {}) {
  const transport = fakeFetch();

  const client = new NuiClient({
    resource: 'panel_test',
    callback: 'nui',
    logger: nullNuiLogger,
    fetch: transport.impl,
    ...overrides,
  });

  return { client, transport };
}

/** Lets a queued microtask/promise settle before assertions. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('NuiClient request/response', () => {
  it('resolves a request with the payload C# sent back', async () => {
    const { client, transport } = makeClient();

    const pending = client.request<{ id: number }, { name: string }>('player:get', { id: 1 });

    await flush();

    const sent = transport.last().body;
    expect(sent.type).toBe('request');
    expect(sent.event).toBe('player:get');
    expect(sent.id).toBeTruthy();

    client.handleMessage({ id: sent.id!, type: 'response', success: true, payload: { name: 'Ada' } });

    await expect(pending).resolves.toEqual({ name: 'Ada' });
  });

  it('rejects with the code C# reported instead of an opaque string', async () => {
    const { client, transport } = makeClient();

    const pending = client.request('inventory:use', { itemId: 'x' });

    await flush();

    client.handleMessage({
      id: transport.last().body.id!,
      type: 'response',
      success: false,
      error: { code: 'ITEM_NOT_FOUND', message: 'nie ma takiego przedmiotu' },
    });

    await expect(pending).rejects.toMatchObject({
      code: 'ITEM_NOT_FOUND',
      message: 'ITEM_NOT_FOUND: nie ma takiego przedmiotu',
    });
  });

  it('rejects with TIMEOUT when C# never answers', async () => {
    const { client } = makeClient();

    const pending = client.request('slow:never', undefined, 20);

    await expect(pending).rejects.toMatchObject({ code: NuiErrorCodes.Timeout });
  });

  it('rejects with ABORTED and drops the request when the caller aborts', async () => {
    const { client, transport } = makeClient();
    const controller = new AbortController();

    const pending = client.request('slow:never', undefined, 5000, controller.signal);

    await flush();
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: NuiErrorCodes.Aborted });

    // The late response for the aborted request is ignored, not thrown.
    expect(() =>
      client.handleMessage({
        id: transport.last().body.id!,
        type: 'response',
        success: true,
        payload: {},
      }),
    ).not.toThrow();
  });

  it('rejects with ABORTED immediately when the signal is already aborted', async () => {
    const { client, transport } = makeClient();
    const controller = new AbortController();
    controller.abort();

    await expect(
      client.request('slow:never', undefined, 5000, controller.signal),
    ).rejects.toMatchObject({ code: NuiErrorCodes.Aborted });

    // Nothing was posted: the request never left the page.
    expect(transport.posts).toHaveLength(0);
  });

  it('falls back to UNKNOWN_ERROR when the failure carries no code', async () => {
    const { client, transport } = makeClient();

    const pending = client.request('weird:event');

    await flush();

    client.handleMessage({ id: transport.last().body.id!, type: 'response', success: false });

    await expect(pending).rejects.toMatchObject({ code: NuiErrorCodes.Unknown });
  });

  it('ignores a response nobody is waiting for', async () => {
    const { client } = makeClient();

    expect(() =>
      client.handleMessage({ id: 'nieistniejace', type: 'response', success: true }),
    ).not.toThrow();
  });
});

describe('NuiClient events', () => {
  it('delivers an event to every subscriber', () => {
    const { client } = makeClient();
    const first = vi.fn();
    const second = vi.fn();

    client.on('state', first);
    client.on('state', second);
    client.handleMessage({ type: 'event', event: 'state', payload: { hp: 50 } });

    expect(first).toHaveBeenCalledWith({ hp: 50 });
    expect(second).toHaveBeenCalledWith({ hp: 50 });
  });

  it('stops delivering after unsubscribe', () => {
    const { client } = makeClient();
    const handler = vi.fn();

    const unsubscribe = client.on('state', handler);
    unsubscribe();
    client.handleMessage({ type: 'event', event: 'state', payload: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('once() fires a single time', () => {
    const { client } = makeClient();
    const handler = vi.fn();

    client.once('tick', handler);
    client.handleMessage({ type: 'event', event: 'tick', payload: 1 });
    client.handleMessage({ type: 'event', event: 'tick', payload: 2 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('lets a handler unsubscribe itself without skipping siblings', () => {
    const { client } = makeClient();
    const second = vi.fn();
    const first = vi.fn(() => {
      unsubscribeFirst();
    });

    const unsubscribeFirst = client.on('state', first);
    client.on('state', second);

    client.handleMessage({ type: 'event', event: 'state', payload: 1 });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('survives a handler that throws', () => {
    const { client } = makeClient();
    const good = vi.fn();

    client.on('state', () => {
      throw new Error('bug w panelu');
    });
    client.on('state', good);

    expect(() => client.handleMessage({ type: 'event', event: 'state' })).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it('off() removes one handler or all of them', () => {
    const { client } = makeClient();
    const first = vi.fn();
    const second = vi.fn();

    client.on('state', first);
    client.on('state', second);
    client.off('state', first);
    client.handleMessage({ type: 'event', event: 'state' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    client.off('state');
    client.handleMessage({ type: 'event', event: 'state' });

    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('NuiClient callbacks for C# requests', () => {
  it('answers a request and echoes the correlation id', async () => {
    const { client, transport } = makeClient();

    client.callback<{ id: number }, { name: string }>('player:get', async request => ({
      success: true,
      value: { name: `gracz-${request.id}` },
    }));

    client.handleMessage({ id: 'req-1', type: 'request', event: 'player:get', payload: { id: 7 } });

    await flush();

    expect(transport.last().body).toMatchObject({
      id: 'req-1',
      type: 'response',
      success: true,
      payload: { name: 'gracz-7' },
    });
  });

  it('reports UNKNOWN_CALLBACK when no handler is registered', async () => {
    const { client, transport } = makeClient();

    client.handleMessage({ id: 'req-2', type: 'request', event: 'nie:ma:handlera' });

    await flush();

    expect(transport.last().body).toMatchObject({
      id: 'req-2',
      success: false,
      error: { code: NuiErrorCodes.UnknownCallback },
    });
  });

  it('turns a throwing handler into CALLBACK_ERROR', async () => {
    const { client, transport } = makeClient();

    client.callback('broken', async () => {
      throw new Error('nieoczekiwany wyjatek');
    });

    client.handleMessage({ id: 'req-3', type: 'request', event: 'broken' });

    await flush();

    expect(transport.last().body).toMatchObject({
      success: false,
      error: { code: NuiErrorCodes.CallbackError, message: 'nieoczekiwany wyjatek' },
    });
  });

  it('unregisterCallback makes C# see UNKNOWN_CALLBACK again', async () => {
    const { client, transport } = makeClient();

    client.callback('temp', async () => ({ success: true, value: 'ok' }));
    expect(client.unregisterCallback('temp')).toBe(true);
    expect(client.unregisterCallback('temp')).toBe(false);

    client.handleMessage({ id: 'req-4', type: 'request', event: 'temp' });

    await flush();

    expect(transport.last().body).toMatchObject({
      error: { code: NuiErrorCodes.UnknownCallback },
    });
  });
});

describe('NuiClient window lifecycle', () => {
  it('forwards open and close to window listeners', () => {
    const { client } = makeClient({ window: 'panel' });
    const handler = vi.fn();

    client.onWindow(handler);
    client.handleMessage({ type: 'open', event: 'panel' });
    client.handleMessage({ type: 'close', event: 'panel' });

    expect(handler).toHaveBeenNthCalledWith(1, 'open', 'panel');
    expect(handler).toHaveBeenNthCalledWith(2, 'close', 'panel');
  });

  it('ignores envelopes for another window', () => {
    const { client } = makeClient({ window: 'panel' });
    const handler = vi.fn();

    client.onWindow(handler);
    client.handleMessage({ type: 'open', event: 'czysty_panel' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('NuiClient delivery', () => {
  it('notify posts to its own callback without waiting for a reply', async () => {
    const { client, transport } = makeClient();

    client.notify('ready', { build: 'abc' });
    await flush();

    expect(transport.last().url).toBe('https://panel_test/ready');
    expect(transport.last().body).toEqual({ build: 'abc' });
  });

  it('encodes the callback name in the URL', async () => {
    const { client, transport } = makeClient();

    client.notify('player name');
    await flush();

    expect(transport.last().url).toBe('https://panel_test/player%20name');
  });

  it('notifyAndWait resolves when the resource answers', async () => {
    const { client } = makeClient();

    await expect(client.notifyAndWait('ready')).resolves.toBeUndefined();
  });

  it('sendAndWait posts to the main callback', async () => {
    const { client, transport } = makeClient();

    await client.sendAndWait('demo:action', { action: 'send' });

    expect(transport.last().url).toBe('https://panel_test/nui');
    expect(transport.last().body).toMatchObject({ type: 'event', event: 'demo:action' });
  });

  it('reports POST_TIMEOUT when the resource stops answering', async () => {
    const { client, transport } = makeClient({ postTimeoutMs: 20 });

    transport.hang();

    await expect(client.notifyAndWait('ready')).rejects.toMatchObject({
      code: NuiErrorCodes.PostTimeout,
    });
  });
});

describe('NuiClient lifecycle and diagnostics', () => {
  it('counts traffic for a diagnostics panel', async () => {
    const { client, transport } = makeClient();

    client.on('state', vi.fn());
    client.callback('player:get', async () => ({ success: true, value: null }));
    client.onWindow(vi.fn());

    const pending = client.request('a:one');
    await flush();
    client.handleMessage({ id: transport.last().body.id!, type: 'response', success: true });
    await pending;

    client.notify('ready');
    await flush();
    client.handleMessage({ type: 'event', event: 'state' });

    const diagnostics = client.getDiagnostics();

    expect(diagnostics.sent).toBe(1);
    expect(diagnostics.notified).toBe(1);
    // The response to our request plus the event pushed afterwards.
    expect(diagnostics.received).toBe(2);
    expect(diagnostics.resolved).toBe(1);
    expect(diagnostics.rejected).toBe(0);
    expect(diagnostics.pending).toBe(0);
    expect(diagnostics.listeners).toBe(1);
    expect(diagnostics.callbacks).toBe(1);
    expect(diagnostics.windowListeners).toBe(1);
  });

  it('dispose() clears everything and rejects requests in flight', async () => {
    const { client } = makeClient();
    const handler = vi.fn();

    client.on('state', handler);
    client.onWindow(vi.fn());
    client.callback('player:get', async () => ({ success: true, value: null }));

    const pending = client.request('never:answered');
    client.dispose();

    await expect(pending).rejects.toMatchObject({ code: NuiErrorCodes.Disposed });
    expect(client.isDisposed()).toBe(true);

    client.handleMessage({ type: 'event', event: 'state' });
    expect(handler).not.toHaveBeenCalled();

    const diagnostics = client.getDiagnostics();
    expect(diagnostics.listeners).toBe(0);
    expect(diagnostics.callbacks).toBe(0);
    expect(diagnostics.windowListeners).toBe(0);

    await expect(client.request('po:dispose')).rejects.toMatchObject({
      code: NuiErrorCodes.Disposed,
    });
  });

  it('is inert after dispose: nothing is sent, registered or handled', async () => {
    const { client, transport } = makeClient();

    client.dispose();

    client.send('demo:action');
    client.notify('ready');
    client.callback('player:get', async () => ({ success: true, value: null }));
    const stop = client.on('state', vi.fn());
    stop();
    client.onWindow(vi.fn());
    client.handleMessage({ type: 'event', event: 'state' });

    await flush();

    expect(transport.posts).toHaveLength(0);
    expect(client.getDiagnostics().callbacks).toBe(0);
    expect(client.getDiagnostics().received).toBe(0);
  });

  it('rejects sendAndWait/notifyAndWait after dispose', async () => {
    const { client } = makeClient();

    client.dispose();

    await expect(client.sendAndWait('demo:action')).rejects.toMatchObject({
      code: NuiErrorCodes.Disposed,
    });
    await expect(client.notifyAndWait('ready')).rejects.toMatchObject({
      code: NuiErrorCodes.Disposed,
    });
  });
});

/**
 * Type tests for NuiClient API.
 * These tests use @ts-expect-error to verify that incorrect calls are rejected by TypeScript.
 * They are not executed at runtime - they validate compile-time type checking.
 */
describe('NuiClient type safety', () => {
  it('requires request payload for request events', async () => {
    const { client } = makeClient();

    // Event 'inventory:use' has a request type, so request() should require a payload
    // @ts-expect-error: missing required request payload for 'inventory:use' event
    client.request('inventory:use');
  });

  it('rejects wrong request payload type', async () => {
    const { client } = makeClient();

    // @ts-expect-error: wrong payload type for 'inventory:use' event
    client.request('inventory:use', { wrongField: 'value' });
  });

  it('accepts correct request payload type', async () => {
    const { client } = makeClient();

    // This should compile: correct type for inventory:use request
    const pending = client.request('inventory:use', { itemId: 'sword' });
    expect(pending).toBeDefined();
  });

  it('sends undefined payload for request events', async () => {
    const { client } = makeClient();

    // Request events expect undefined payload when using send
    client.send('inventory:use', undefined);
  });

  it('requires payload for payload events', async () => {
    const { client } = makeClient();

    // @ts-expect-error: missing required payload for payload event
    client.send('player:healthChanged');
  });

  it('sends correct payload type for payload events', async () => {
    const { client } = makeClient();

    // This should compile: correct payload type
    client.send('player:healthChanged', { health: 100 });
  });

  it('rejects wrong payload type for payload events', async () => {
    const { client } = makeClient();

    // @ts-expect-error: wrong payload type for 'player:healthChanged'
    client.send('player:healthChanged', 'invalid string payload');
  });
});

/** Minimal Window mock that records `message` listeners and dispatches synthetic events. */
function mockWindow(): { window: Window; dispatch: (data: unknown) => void } {
  const listeners = new Set<EventListener>();
  return {
    window: {
      addEventListener: (_type: string, listener: EventListener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: EventListener) => {
        listeners.delete(listener);
      },
    } as unknown as Window,
    dispatch: (data: unknown) => {
      const event = { data, type: 'message' } as unknown as MessageEvent;
      listeners.forEach(listener => listener(event));
    },
  };
}

describe('NuiClient listen (FiveM SendNuiMessage delivers JSON string)', () => {
  it('parses a JSON string from event.data and delivers it', () => {
    const { client } = makeClient();
    const handler = vi.fn();
    client.on('player:data', handler);

    const { window, dispatch } = mockWindow();
    client.listen(window);

    // FiveM SendNuiMessage(string) → event.data is a JSON STRING, not an object
    dispatch(JSON.stringify({ type: 'event', event: 'player:data', payload: { health: 100 } }));

    expect(handler).toHaveBeenCalledWith({ health: 100 });
  });

  it('ignores malformed JSON instead of throwing from the listener', () => {
    const { client } = makeClient();
    const { window, dispatch } = mockWindow();
    client.listen(window);

    expect(() => dispatch('{ not json')).not.toThrow();
  });

  it('passes through pre-parsed objects for non-FiveM environments', () => {
    const { client } = makeClient();
    const handler = vi.fn();
    client.on('player:data', handler);

    const { window, dispatch } = mockWindow();
    client.listen(window);

    dispatch({ type: 'event', event: 'player:data', payload: { health: 100 } });

    expect(handler).toHaveBeenCalledWith({ health: 100 });
  });

  it('delivers responses through listen() to resolve pending requests', async () => {
    const { client, transport } = makeClient();

    const pending = client.request('player:get', { id: 1 });
    await flush();

    const corrId = transport.last().body.id!;

    const { window, dispatch } = mockWindow();
    client.listen(window);

    dispatch(JSON.stringify({ id: corrId, type: 'response', success: true, payload: { name: 'Ada' } }));

    await expect(pending).resolves.toEqual({ name: 'Ada' });
  });

  it('routes window lifecycle envelopes received as JSON strings', () => {
    const { client } = makeClient({ window: 'panel' });
    const handler = vi.fn();
    client.onWindow(handler);

    const { window, dispatch } = mockWindow();
    client.listen(window);

    dispatch(JSON.stringify({ type: 'open', event: 'panel' }));

    expect(handler).toHaveBeenCalledWith('open', 'panel');
  });

  it('unlistens on teardown so stale handlers do not fire', () => {
    const { client } = makeClient();
    const handler = vi.fn();
    client.on('state', handler);

    const { window, dispatch } = mockWindow();
    const stop = client.listen(window);
    stop();

    dispatch(JSON.stringify({ type: 'event', event: 'state' }));

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('MessageTransport', () => {
  it('classifies a plain AbortError from a non-DOMException source as POST_TIMEOUT', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const transport = new MessageTransport('panel_test', 'nui', 1000, nullNuiLogger, () =>
      Promise.reject(abortError),
    );

    await expect(transport.post('https://panel_test/nui', {})).rejects.toMatchObject({
      code: NuiErrorCodes.PostTimeout,
    });
  });

  it('encodes special characters in callback URLs', () => {
    const transport = new MessageTransport('panel_test', 'nui', 1000, nullNuiLogger, () =>
      Promise.resolve(new Response('{}', { status: 200 })),
    );

    expect(transport.callbackUrl('player name')).toBe('https://panel_test/player%20name');
    expect(transport.mainCallbackUrl).toBe('https://panel_test/nui');
  });
});

describe('NuiRequestError', () => {
  it('carries a machine-readable code and a readable message', () => {
    const error = new NuiRequestError(NuiErrorCodes.Timeout, 'po 30s');

    expect(isNuiRequestError(error)).toBe(true);
    expect(isNuiRequestError(new Error('x'))).toBe(false);
    expect(error.name).toBe('NuiRequestError');
    expect(error.message).toBe('TIMEOUT: po 30s');
  });
});
