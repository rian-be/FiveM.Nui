import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SvelteNuiClient } from '../../src/client';
import { nui, createNui } from '../../src/index';
import { NuiClient as CoreNuiClient } from '@fivem-nui/core';

describe('SvelteNuiClient', () => {
  let fakeFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options and starts listening automatically', () => {
    const client = new SvelteNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    expect(client).toBeInstanceOf(SvelteNuiClient);
    expect(client.getClient()).toBeDefined();
    expect(client.getTypedClient()).toBeInstanceOf(CoreNuiClient);
    client.destroy();
  });

  it('respects autoInitialize: false and starts listening only when listen() is called', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const listenSpy = vi.spyOn(core, 'listen');

    const client = new SvelteNuiClient({ client: core, autoInitialize: false });
    expect(listenSpy).not.toHaveBeenCalled();

    const unsub = client.listen();
    expect(listenSpy).toHaveBeenCalledTimes(1);

    unsub();
    client.destroy();
  });

  it('lazily activates listening via _ensureListening when autoInitialize is false', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const listenSpy = vi.spyOn(core, 'listen');

    const client = new SvelteNuiClient({ client: core, autoInitialize: false });
    expect(listenSpy).not.toHaveBeenCalled();

    // Calling on() invokes _ensureListening()
    const handler = vi.fn();
    const unsub = client.on('lazy:event', handler);
    expect(listenSpy).toHaveBeenCalledTimes(1);

    unsub();
    client.destroy();
  });

  it('registers and unregisters event listener via on()', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const handler = vi.fn();
    const unsub = client.on('player:spawn', handler);

    // Dispatch message event
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'player:spawn', payload: { x: 10, y: 20 } }
      })
    );

    expect(handler).toHaveBeenCalledWith({ x: 10, y: 20 });

    // Unsubscribe
    unsub();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'player:spawn', payload: { x: 30, y: 40 } }
      })
    );
    expect(handler).toHaveBeenCalledTimes(1);

    client.destroy();
  });

  it('registers once() listener which automatically unregisters after first call', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const handler = vi.fn();
    client.once('init:config', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'init:config', payload: { debug: true } }
      })
    );
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ debug: true });

    // Second event should not trigger handler
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'init:config', payload: { debug: false } }
      })
    );
    expect(handler).toHaveBeenCalledTimes(1);

    client.destroy();
  });

  it('allows manual unsubscription of once() before event triggers', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const handler = vi.fn();
    const unsub = client.once('one:time', handler);
    unsub();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'one:time', payload: { foo: 'bar' } }
      })
    );
    expect(handler).not.toHaveBeenCalled();

    client.destroy();
  });

  it('removes listener via off()', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const handler = vi.fn();
    client.on('chat:message', handler);
    client.off('chat:message', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'chat:message', payload: 'hello' }
      })
    );
    expect(handler).not.toHaveBeenCalled();

    client.destroy();
  });

  it('sends messages via send() and sendAndWait()', async () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    client.send('ui:ready', { status: 'ok' });
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    await client.sendAndWait('ui:sync', { step: 1 });
    expect(fakeFetch).toHaveBeenCalledTimes(2);

    client.destroy();
  });

  it('sends requests via request() and returns response', async () => {
    let capturedId: string | undefined;
    fakeFetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body as string);
      capturedId = body.id;
      // Simulate C# backend sending correlated response message
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { id: capturedId, type: 'response', success: true, payload: { balance: 500 } }
          })
        );
      }, 0);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const result = await client.request('bank:getBalance');
    expect(result).toEqual({ balance: 500 });

    client.destroy();
  });

  it('sends notifications via notify() and notifyAndWait()', async () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    client.notify('close', { reason: 'user' });
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    await client.notifyAndWait('ready', { timestamp: 1234 });
    expect(fakeFetch).toHaveBeenCalledTimes(2);

    client.destroy();
  });

  it('registers and unregisters callbacks for requests from backend', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const handler = vi.fn().mockResolvedValue({ success: true, value: 42 });
    client.callback('compute:value', handler);

    const unregistered = client.unregisterCallback('compute:value');
    expect(unregistered).toBe(true);

    client.destroy();
  });

  it('listens for window lifecycle events via onWindow()', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const handler = vi.fn();
    const unsub = client.onWindow(handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'open', event: 'inventory' }
      })
    );
    expect(handler).toHaveBeenCalledWith('open', 'inventory');

    unsub();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'close', event: 'inventory' }
      })
    );
    expect(handler).toHaveBeenCalledTimes(1);

    client.destroy();
  });

  it('cleans up all listeners on destroy()', () => {
    const core = new CoreNuiClient({ fetch: fakeFetch, resource: 'test_res' });
    const client = new SvelteNuiClient({ client: core });

    const h1 = vi.fn();
    const h2 = vi.fn();
    client.on('event1', h1);
    client.on('event2', h2);

    client.destroy();

    window.dispatchEvent(new MessageEvent('message', { data: { type: 'event', event: 'event1', payload: 1 } }));
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'event', event: 'event2', payload: 2 } }));

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('supports captureGlobalErrors: true and cleans up on destroy()', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const client = new SvelteNuiClient({
      autoInitialize: false,
      captureGlobalErrors: true
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

    client.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
});

describe('index entrypoint exports', () => {
  it('provides singleton nui and createNui factory', () => {
    expect(nui).toBeInstanceOf(SvelteNuiClient);

    const custom = createNui({ autoInitialize: false });
    expect(custom).toBeInstanceOf(SvelteNuiClient);
    custom.destroy();
  });
});
