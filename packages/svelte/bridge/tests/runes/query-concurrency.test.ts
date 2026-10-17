import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { SvelteNuiClient } from '../../src/client';
import { setDefaultNuiClient, resetDefaultNuiClient } from '../../src/context';
import { useNuiQuery } from '../../src/runes/query.svelte';
import TestHost from '../helpers/TestHost.svelte';

describe('useNuiQuery rune - concurrency & abort handling', () => {
  let client: SvelteNuiClient;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    client = new SvelteNuiClient({ autoInitialize: false });
    setDefaultNuiClient(client);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    client.destroy();
    resetDefaultNuiClient();
    vi.restoreAllMocks();
  });

  function mountQuery<TReq, TRes>(factory: () => any): { query: any; unmount: () => void } {
    let query: any;
    const app = mount(TestHost, {
      target: container,
      props: {
        queryFactory: () => {
          query = factory();
        }
      }
    });
    flushSync();
    return { query, unmount: () => unmount(app) };
  }

  it('aborts previous pending request when execute() is called consecutively', async () => {
    let callCount = 0;
    vi.spyOn(client, 'request').mockImplementation((_ev, _req, _timeout, signal) => {
      callCount++;
      const currentCall = callCount;
      return new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        if (currentCall === 2) {
          setTimeout(() => resolve('second-result'), 10);
        }
      });
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('concurrent:event', { client })
    );
    const p1 = query.execute('first');
    const p2 = query.execute('second');

    // First request should be rejected due to abort
    await expect(p1).rejects.toThrow();
    const result2 = await p2;
    expect(result2).toBe('second-result');
    expect(query.data).toBe('second-result');
    unmount();
  });

  it('handles superseded request failures without corrupting subsequent request error state', async () => {
    vi.spyOn(client, 'request').mockImplementation((_ev, req) => {
      if (req === 'first') {
        return new Promise((_, reject) => setTimeout(() => reject(new Error('first failed')), 20));
      }
      return new Promise((resolve) => setTimeout(() => resolve('second ok'), 10));
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('supersede:event', { client })
    );
    const p1 = query.execute('first');
    const p2 = query.execute('second');

    let p1Err: unknown;
    await p1.catch((e) => {
      p1Err = e;
    });
    expect(p1Err).toBeDefined();
    expect((p1Err as Error).name).toBe('AbortError');

    await expect(p2).resolves.toBe('second ok');
    expect(query.data).toBe('second ok');
    expect(query.error).toBeNull();
    unmount();
  });

  it('supports abort() and immediate execution option', async () => {
    vi.spyOn(client, 'request').mockImplementation((_ev, _req, _timeout, signal) => {
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => resolve(undefined as any));
      });
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('immediate:event', { client, immediate: true, initialRequest: 'init' })
    );
    expect(query.called).toBe(true);
    expect(query.loading).toBe(true);

    query.abort();
    expect(query.loading).toBe(false);
    unmount();
  });

  it('rejects with AbortError and does NOT update data or onSuccess when response arrives after abort()', async () => {
    const onSuccess = vi.fn();
    let resolveRequest!: (val: string) => void;
    vi.spyOn(client, 'request').mockImplementation(() => {
      return new Promise((resolve) => {
        resolveRequest = resolve;
      });
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery<void, string>('delayed:event', { client, onSuccess })
    );

    const promise = query.execute();
    expect(query.loading).toBe(true);

    // Manually abort
    query.abort();
    expect(query.loading).toBe(false);

    // Server responds anyway
    resolveRequest('late-data');

    await expect(promise).rejects.toThrow();
    expect(query.data).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    unmount();
  });

  it('automatically aborts in-flight request on component unmount', () => {
    let abortFired = false;
    vi.spyOn(client, 'request').mockImplementation((_ev, _req, _timeout, signal) => {
      signal?.addEventListener('abort', () => {
        abortFired = true;
      });
      return new Promise(() => {}); // pending forever
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('unmount:event', { client })
    );

    void query.execute().catch(() => {});
    expect(query.loading).toBe(true);

    // Unmount component
    unmount();
    expect(abortFired).toBe(true);
  });

  it('keeps loading true when superseded request A finishes while request B is still pending', async () => {
    let resolveA!: (val: string) => void;
    let resolveB!: (val: string) => void;

    vi.spyOn(client, 'request').mockImplementation((_ev, req) => {
      if (req === 'A') {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      return new Promise((resolve) => {
        resolveB = resolve;
      });
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery<string, string>('order:test', { client })
    );

    const pA = query.execute('A');
    expect(query.loading).toBe(true);

    const pB = query.execute('B');
    expect(query.loading).toBe(true);

    // Request A completes while B is still in flight
    resolveA('resA');
    await expect(pA).rejects.toThrow(); // Rejected with AbortError

    // Query loading must STILL be true because B is running!
    expect(query.loading).toBe(true);
    expect(query.data).toBeNull();

    // Now B completes
    resolveB('resB');
    const resB = await pB;
    expect(resB).toBe('resB');
    expect(query.loading).toBe(false);
    expect(query.data).toBe('resB');

    unmount();
  });

  it('preserves query state when earlier request A finishes after newer request B has already completed', async () => {
    let resolveA!: (val: string) => void;
    let resolveB!: (val: string) => void;

    vi.spyOn(client, 'request').mockImplementation((_ev, req) => {
      if (req === 'A') {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      return new Promise((resolve) => {
        resolveB = resolve;
      });
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery<string, string>('order2:test', { client })
    );

    const pA = query.execute('A');
    const pB = query.execute('B');

    // B resolves first!
    resolveB('resB');
    await expect(pB).resolves.toBe('resB');
    expect(query.loading).toBe(false);
    expect(query.data).toBe('resB');

    // A resolves later
    resolveA('resA');
    await expect(pA).rejects.toThrow(); // Throws AbortError

    // Query state must remain B's data and not loading
    expect(query.loading).toBe(false);
    expect(query.data).toBe('resB');

    unmount();
  });

  it('does not invoke onError or set error when client.request rejects with AbortError directly', async () => {
    const onError = vi.fn();
    const abortErr = new DOMException('Operation aborted by caller', 'AbortError');
    vi.spyOn(client, 'request').mockRejectedValueOnce(abortErr);

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('direct:abort', { client, onError })
    );

    const promise = query.execute();
    await expect(promise).rejects.toThrow();
    expect(query.error).toBeNull();
    expect(query.loading).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    unmount();
  });

  it('does not update data or onSuccess when server responds after component was unmounted', async () => {
    const onSuccess = vi.fn();
    let resolveServer!: (val: string) => void;
    vi.spyOn(client, 'request').mockImplementation(() => {
      return new Promise((resolve) => {
        resolveServer = resolve;
      });
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery<void, string>('unmount:late', { client, onSuccess })
    );

    const promise = query.execute();
    expect(query.loading).toBe(true);

    // Unmount before response arrives
    unmount();

    // Late server resolution
    resolveServer('late-value');
    await expect(promise).rejects.toThrow();

    expect(query.data).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
