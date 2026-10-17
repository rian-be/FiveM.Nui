import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupNuiMock, isNuiUrl, parseNuiUrl } from '../../src/mock';
import * as env from '../../src/utils/env';
import { NOOP_CONTROLLER } from '../../src/mock/types';

describe('setupNuiMock', () => {
  let originalFetch: typeof window.fetch;

  beforeEach(() => {
    originalFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ external: true })));
    window.fetch = originalFetch;
    delete (window as any).__nuiMock;
  });

  afterEach(() => {
    if ((window as any).__nuiMock?.destroy) {
      (window as any).__nuiMock.destroy();
    }
    window.fetch = originalFetch;
    delete (window as any).__nuiMock;
    vi.restoreAllMocks();
  });

  it('does NOT intercept foreign URLs like example.com or localhost', async () => {
    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 0
    });

    // 1. External domain with dot
    await window.fetch('https://example.com/api/test');
    expect(originalFetch).toHaveBeenCalledWith('https://example.com/api/test', undefined);

    // 2. Localhost
    await window.fetch('https://localhost/api');
    expect(originalFetch).toHaveBeenCalledWith('https://localhost/api', undefined);

    // 3. Localhost with port
    await window.fetch('https://localhost:3000/api');
    expect(originalFetch).toHaveBeenCalledWith('https://localhost:3000/api', undefined);

    // 4. Different resource name
    await window.fetch('https://other_resource/nui');
    expect(originalFetch).toHaveBeenCalledWith('https://other_resource/nui', undefined);

    mock.destroy();
  });

  it('intercepts matching NUI URLs and cfx-nui prefixed URLs', async () => {
    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 0,
      requests: {
        'player:getData': () => ({ score: 100 })
      }
    });

    const postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});

    // Target resource
    await window.fetch('https://my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({
        id: 'req-1',
        event: 'player:getData',
        payload: {}
      })
    });

    expect(originalFetch).not.toHaveBeenCalled();
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        id: 'req-1',
        success: true,
        payload: { score: 100 }
      }),
      '*'
    );

    // cfx-nui prefix
    await window.fetch('https://cfx-nui-my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({
        id: 'req-2',
        event: 'player:getData',
        payload: {}
      })
    });

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'response',
        id: 'req-2',
        success: true,
        payload: { score: 100 }
      }),
      '*'
    );

    mock.destroy();
  });

  it('destroy() completely restores fetch and cleans up window.__nuiMock', () => {
    const mock = setupNuiMock({ latencyMs: 0 });
    expect((window as any).__nuiMock).toBe(mock);
    expect(window.fetch).not.toBe(originalFetch);

    mock.destroy();

    expect(window.fetch).toBe(originalFetch);
    expect((window as any).__nuiMock).toBeUndefined();
  });

  it('calling setupNuiMock twice destroys previous controller without nesting fetch wrappers', () => {
    const mock1 = setupNuiMock({ latencyMs: 0 });
    const destroySpy1 = vi.spyOn(mock1, 'destroy');

    const mock2 = setupNuiMock({ latencyMs: 0 });

    expect(destroySpy1).toHaveBeenCalled();
    expect((window as any).__nuiMock).toBe(mock2);

    mock2.destroy();
    expect(window.fetch).toBe(originalFetch);
    expect((window as any).__nuiMock).toBeUndefined();
  });

  it('handles request error with unified error shape across postMessage and HTTP', async () => {
    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 0,
      requests: {
        'item:buy': () => {
          const err = new Error('Not enough funds');
          (err as any).code = 'INSUFFICIENT_FUNDS';
          throw err;
        }
      }
    });

    const postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});

    const response = await window.fetch('https://my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({
        id: 'req-err',
        event: 'item:buy',
        payload: { item: 'sword' }
      })
    });

    // 1. HTTP response shape
    expect(response.status).toBe(500);
    const httpBody = await response.json();
    expect(httpBody).toEqual({
      success: false,
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Not enough funds'
      }
    });

    // 2. postMessage response shape
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: 'response',
        id: 'req-err',
        success: false,
        error: {
          code: 'INSUFFICIENT_FUNDS',
          message: 'Not enough funds'
        }
      },
      '*'
    );

    mock.destroy();
  });

  it('logs warning when no handler is registered for a message', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 0,
      log: true
    });

    const res = await window.fetch('https://my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({
        event: 'unhandled:event',
        payload: { foo: 'bar' }
      })
    });

    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unhandled NUI message: no mock handler registered for 'unhandled:event'")
    );

    mock.destroy();
  });

  it('allows unregistering mock handlers via returned callback or removeRequest', async () => {
    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 0
    });

    const unreg = mock.mockRequest('temp:event', () => 'ok');

    // Unregister via returned function
    unreg();

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await window.fetch('https://my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({ event: 'temp:event' })
    });

    expect(warnSpy).toHaveBeenCalled();
    mock.destroy();
  });

  it('validates isNuiUrl and parseNuiUrl helper functions directly', () => {
    // Valid NUI URLs
    expect(isNuiUrl('https://my_resource/nui', 'my_resource')).toBe(true);
    expect(isNuiUrl('https://cfx-nui-my_resource/nui', 'my_resource')).toBe(true);

    // Invalid / foreign URLs
    expect(isNuiUrl('https://localhost/api', 'my_resource')).toBe(false);
    expect(isNuiUrl('https://127.0.0.1/api', 'my_resource')).toBe(false);
    expect(isNuiUrl('https://example.com/api', 'my_resource')).toBe(false);
    expect(isNuiUrl('http://my_resource/nui', 'my_resource')).toBe(false); // http not https
    expect(isNuiUrl('https://my_resource:3000/nui', 'my_resource')).toBe(false); // has port
    expect(isNuiUrl('not-a-url', 'my_resource')).toBe(false);

    // Parsing
    const parsed1 = parseNuiUrl('https://my_resource/my%20callback');
    expect(parsed1.resourceName).toBe('my_resource');
    expect(parsed1.callbackName).toBe('my callback');

    const parsed2 = parseNuiUrl('https://my_resource/malformed%E0%A4%A');
    expect(parsed2.resourceName).toBe('my_resource');
    expect(parsed2.callbackName).toBe('malformed%E0%A4%A');
  });

  it('emits events via emitEvent (synchronous and with delay)', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const mock = setupNuiMock({ resourceName: 'my_resource' });

    // Synchronous emit
    mock.emitEvent('player:healed', { hp: 100 });
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event', event: 'player:healed', payload: { hp: 100 } }),
      '*'
    );

    // Delayed emit
    mock.emitEvent('player:delayed', { hp: 50 }, 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'event', event: 'player:delayed', payload: { hp: 50 } }),
      '*'
    );

    mock.destroy();
  });

  it('emits window actions via emitWindow (synchronous and with delay)', async () => {
    const postMessageSpy = vi.spyOn(window, 'postMessage').mockImplementation(() => {});
    const mock = setupNuiMock({ resourceName: 'my_resource' });

    // Synchronous emitWindow
    mock.emitWindow('open', 'hud');
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'open', event: 'hud', action: 'open', window: 'hud' }),
      '*'
    );

    // Delayed emitWindow
    mock.emitWindow('close', 'inventory', 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'close', event: 'inventory', action: 'close', window: 'inventory' }),
      '*'
    );

    mock.destroy();
  });

  it('handles callbacks and onSend, including error safety in handlers', async () => {
    const cbHandler = vi.fn().mockImplementation(() => {
      throw new Error('Callback failed');
    });
    const sendHandler = vi.fn().mockImplementation(() => {
      throw new Error('Send failed');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 0,
      callbacks: {
        'native:cb': cbHandler
      }
    });

    const unregSend = mock.onSend('user:action', sendHandler);

    // Trigger callback
    await window.fetch('https://my_resource/native:cb', {
      method: 'POST',
      body: JSON.stringify({ payload: { arg: 1 } })
    });
    expect(cbHandler).toHaveBeenCalledWith({ arg: 1 });
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Error in callback handler 'native:cb'"), expect.any(Error));

    // Trigger onSend
    await window.fetch('https://my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({ event: 'user:action', payload: { click: true } })
    });
    expect(sendHandler).toHaveBeenCalledWith({ click: true });
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Error in send handler 'user:action'"), expect.any(Error));

    // Unregister onSend
    unregSend();

    // Trigger again: onSend should not fire
    await window.fetch('https://my_resource/nui', {
      method: 'POST',
      body: JSON.stringify({ event: 'user:action', payload: { click: false } })
    });
    expect(sendHandler).toHaveBeenCalledTimes(1);

    // removeRequest
    mock.mockRequest('delete:me', () => 'ok');
    mock.removeRequest('delete:me');

    mock.destroy();
  });

  it('returns NOOP_CONTROLLER when running inside FiveM CEF (isNui)', () => {
    const isNuiSpy = vi.spyOn(env, 'isNui').mockReturnValue(true);
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const mock = setupNuiMock({ log: true });
    expect(mock).toBe(NOOP_CONTROLLER);
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Running inside FiveM CEF - mock interceptor disabled.')
    );

    // Call all NOOP_CONTROLLER methods to verify they are safe no-ops
    NOOP_CONTROLLER.emitEvent('test');
    NOOP_CONTROLLER.emitWindow('open');
    const unsubReq = NOOP_CONTROLLER.mockRequest('test', () => {});
    unsubReq();
    NOOP_CONTROLLER.removeRequest('test');
    const unsubSend = NOOP_CONTROLLER.onSend('test', () => {});
    unsubSend();
    NOOP_CONTROLLER.destroy();

    isNuiSpy.mockRestore();
  });

  it('supports simulated latencyMs > 0 and handles Request instance with non-JSON body', async () => {
    const mock = setupNuiMock({
      resourceName: 'my_resource',
      latencyMs: 10
    });

    const start = Date.now();
    const req = new Request('https://my_resource/nui', {
      method: 'POST',
      body: 'non-json string body'
    });
    const res = await window.fetch(req);
    expect(res.status).toBe(200);
    expect(Date.now() - start).toBeGreaterThanOrEqual(5);

    // Request with no body
    const resEmpty = await window.fetch('https://my_resource/nui', { method: 'POST' });
    expect(resEmpty.status).toBe(200);

    mock.destroy();
  });
});
