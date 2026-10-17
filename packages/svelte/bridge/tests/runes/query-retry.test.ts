import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { NuiErrorCodes, NuiRequestError } from '@fivem-nui/core';
import { globalErrorHandler, NuiErrorCategory } from '@fivem-nui/error';
import { SvelteNuiClient } from '../../src/client';
import { setDefaultNuiClient, resetDefaultNuiClient } from '../../src/context';
import { useNuiQuery, NuiQueryStatus } from '../../src/runes/query.svelte';
import TestHost from '../helpers/TestHost.svelte';

describe('useNuiQuery rune - retry & error integration', () => {
  let client: SvelteNuiClient;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    client = new SvelteNuiClient({ autoInitialize: false });
    setDefaultNuiClient(client);
    globalErrorHandler.clearHistory();
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    client.destroy();
    resetDefaultNuiClient();
    globalErrorHandler.clearHistory();
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

  it('retries on timeout error with exponential backoff and succeeds on subsequent try', async () => {
    let attempts = 0;
    vi.spyOn(client, 'request').mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        throw new NuiRequestError('TIMEOUT: C# backend lagged', NuiErrorCodes.TIMEOUT);
      }
      return { success: true, attempt: attempts } as any;
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('shop:buy', {
        client,
        retry: {
          maxRetries: 2,
          baseDelay: 10,
          maxDelay: 50,
          jitter: 0,
          retryOnTimeout: true
        }
      })
    );

    const result = await query.execute({ item: 'bread' });
    expect(result).toEqual({ success: true, attempt: 2 });
    expect(attempts).toBe(2);
    expect(query.status).toBe(NuiQueryStatus.Success);
    expect(query.data).toEqual({ success: true, attempt: 2 });
    unmount();
  });

  it('stops retrying when maxRetries is reached and captures error in globalErrorHandler', async () => {
    let attempts = 0;
    vi.spyOn(client, 'request').mockImplementation(async () => {
      attempts++;
      throw new NuiRequestError('Network error', NuiErrorCodes.TRANSPORT);
    });

    const onError = vi.fn();
    const { query, unmount } = mountQuery(() =>
      useNuiQuery('shop:buy', {
        client,
        retry: {
          maxRetries: 2,
          baseDelay: 5,
          maxDelay: 20,
          jitter: 0,
          retryOnNetworkError: true
        },
        onError
      })
    );

    await expect(query.execute()).rejects.toThrow();
    expect(attempts).toBe(3); // 1 initial + 2 retries
    expect(query.status).toBe(NuiQueryStatus.Error);
    expect(onError).toHaveBeenCalled();

    const history = globalErrorHandler.getErrorHistory();
    expect(history.length).toBeGreaterThan(0);
    const queryError = history.find((e) => e.operation === 'useNuiQuery:request');
    expect(queryError).toBeDefined();
    expect(queryError?.category).toBe(NuiErrorCategory.NETWORK);
    unmount();
  });

  it('does not retry when request is explicitly aborted', async () => {
    let attempts = 0;
    vi.spyOn(client, 'request').mockImplementation(async (_event, _req, _timeout, signal) => {
      attempts++;
      if (signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      throw new NuiRequestError('TIMEOUT', NuiErrorCodes.TIMEOUT);
    });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('slow:task', {
        client,
        retry: {
          maxRetries: 3,
          baseDelay: 10,
          jitter: 0
        }
      })
    );

    const execPromise = query.execute();
    query.abort();

    await expect(execPromise).rejects.toThrow();
    expect(attempts).toBe(1);
    expect(query.loading).toBe(false);
    unmount();
  });
});
