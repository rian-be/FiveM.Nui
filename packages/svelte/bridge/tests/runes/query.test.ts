import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { NuiErrorCodes, NuiRequestError } from '@fivem-nui/core';
import { SvelteNuiClient } from '../../src/client';
import { setDefaultNuiClient, resetDefaultNuiClient } from '../../src/context';
import { useNuiQuery, NuiQueryStatus } from '../../src/runes/query.svelte';
import TestHost from '../helpers/TestHost.svelte';

describe('useNuiQuery rune - core lifecycle & state', () => {
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

  it('executes requests and updates reactive state (loading, data, called, onSuccess)', async () => {
    const onSuccess = vi.fn();
    const { query, unmount } = mountQuery(() =>
      useNuiQuery<{ id: string }, { name: string }>('item:get', { client, onSuccess })
    );

    expect(query.loading).toBe(false);
    expect(query.data).toBeNull();
    expect(query.called).toBe(false);
    expect(query.error).toBeNull();
    expect(query.lastUpdated).toBeNull();

    // Mock client.request
    vi.spyOn(client, 'request').mockResolvedValueOnce({ name: 'Medkit' });

    const promise = query.execute({ id: 'item_1' });
    expect(query.loading).toBe(true);
    expect(query.called).toBe(true);

    const result = await promise;
    expect(result).toEqual({ name: 'Medkit' });
    expect(query.data).toEqual({ name: 'Medkit' });
    expect(query.loading).toBe(false);
    expect(query.lastUpdated).toBeTypeOf('number');
    expect(onSuccess).toHaveBeenCalledWith({ name: 'Medkit' });

    // Refetch
    vi.spyOn(client, 'request').mockResolvedValueOnce({ name: 'Medkit+' });
    const refetchResult = await query.refetch();
    expect(refetchResult).toEqual({ name: 'Medkit+' });

    // Reset
    query.reset();
    expect(query.data).toBeNull();
    expect(query.called).toBe(false);
    unmount();
  });

  it('handles query errors (including non-Error throws) and notifies onError callback', async () => {
    const onError = vi.fn();
    const { query, unmount } = mountQuery(() =>
      useNuiQuery('error:event', { client, onError })
    );

    vi.spyOn(client, 'request').mockRejectedValueOnce('string error');

    await expect(query.execute()).rejects.toThrow('string error');
    expect(query.error?.message).toBe('string error');
    expect(query.loading).toBe(false);
    expect(onError).toHaveBeenCalled();
    unmount();
  });

  it('preserves lastRequest when execute() is called without argument', async () => {
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue('ok');
    const { query, unmount } = mountQuery(() =>
      useNuiQuery<{ count: number }, string>('param:event', { client })
    );

    await query.execute({ count: 5 });
    expect(requestSpy).toHaveBeenLastCalledWith('param:event', { count: 5 }, undefined, expect.any(AbortSignal));

    // Subsequent call without arguments reuses { count: 5 }
    await query.execute();
    expect(requestSpy).toHaveBeenLastCalledWith('param:event', { count: 5 }, undefined, expect.any(AbortSignal));

    // Refetch also reuses { count: 5 }
    await query.refetch();
    expect(requestSpy).toHaveBeenLastCalledWith('param:event', { count: 5 }, undefined, expect.any(AbortSignal));

    unmount();
  });

  it('distinguishes explicit execute(undefined) from omitting payload execute()', async () => {
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue('ok');
    const { query, unmount } = mountQuery(() =>
      useNuiQuery<unknown, string>('explicit:param', { client, initialRequest: 'init-payload' })
    );

    // Initial refetch reuses initialRequest
    await query.refetch();
    expect(requestSpy).toHaveBeenLastCalledWith('explicit:param', 'init-payload', undefined, expect.any(AbortSignal));

    // Explicitly passing undefined as argument overwrites lastRequest with undefined
    await query.execute(undefined);
    expect(requestSpy).toHaveBeenLastCalledWith('explicit:param', undefined, undefined, expect.any(AbortSignal));

    // Subsequent refetch now uses undefined
    await query.refetch();
    expect(requestSpy).toHaveBeenLastCalledWith('explicit:param', undefined, undefined, expect.any(AbortSignal));

    unmount();
  });

  it('passes overrideTimeout and supports timeout: 0 for no limit', async () => {
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue('ok');
    const { query, unmount } = mountQuery(() =>
      useNuiQuery('timeout:event', { client, timeout: 5000 })
    );

    await query.execute('data', 0); // override with 0
    expect(requestSpy).toHaveBeenLastCalledWith('timeout:event', 'data', 0, expect.any(AbortSignal));

    await query.execute('data'); // uses options.timeout (5000)
    expect(requestSpy).toHaveBeenLastCalledWith('timeout:event', 'data', 5000, expect.any(AbortSignal));
    unmount();
  });

  it('handles timeout from client.request as error (not silent abort) and calls onError', async () => {
    const onError = vi.fn();
    const timeoutError = new NuiRequestError(NuiErrorCodes.Timeout, 'No response after 3000ms');
    vi.spyOn(client, 'request').mockRejectedValueOnce(timeoutError);

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('timeout:test', { client, onError })
    );

    await expect(query.execute()).rejects.toThrow('No response after 3000ms');
    expect(query.loading).toBe(false);
    expect(query.error).toBe(timeoutError);
    expect(onError).toHaveBeenCalledWith(timeoutError);
    unmount();
  });

  it('times out when no response arrives within timeout: 50, populating query.error and calling onError', async () => {
    const onError = vi.fn();
    const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const clientWithFetch = new SvelteNuiClient({ fetch: fakeFetch, resource: 'test_res' });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('real:timeout', { client: clientWithFetch, timeout: 50, onError })
    );

    const promise = query.execute();
    expect(query.loading).toBe(true);

    await expect(promise).rejects.toThrow(/after 50ms/);
    expect(query.loading).toBe(false);
    expect(query.error).toBeInstanceOf(Error);
    expect(query.error?.message).toMatch(/after 50ms/);
    expect(onError).toHaveBeenCalledWith(query.error);

    clientWithFetch.destroy();
    unmount();
  });

  it('preserves success data state and does not invoke onError when onSuccess callback throws', async () => {
    const onError = vi.fn();
    const onSuccess = vi.fn().mockImplementation(() => {
      throw new Error('callback crashed');
    });
    vi.spyOn(client, 'request').mockResolvedValueOnce({ id: 'item_123' });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery<{ id: string }, { id: string }>('callback:throw', {
        client,
        onSuccess,
        onError
      })
    );

    const result = await query.execute();
    expect(result).toEqual({ id: 'item_123' });
    expect(query.data).toEqual({ id: 'item_123' });
    expect(query.loading).toBe(false);
    expect(query.error).toBeNull();
    expect(onError).not.toHaveBeenCalled();
    unmount();
  });

  it('rejects subsequent execute and refetch calls after destroy', async () => {
    const { query, unmount } = mountQuery(() =>
      useNuiQuery('test:destroy', { client })
    );

    query.destroy();
    await expect(query.execute()).rejects.toThrow('Cannot execute request on a destroyed query controller');
    await expect(query.refetch()).rejects.toThrow('Cannot execute request on a destroyed query controller');

    unmount();
  });

  it('verifies NuiQueryStatus transitions and query.status getter', async () => {
    const { query, unmount } = mountQuery(() => useNuiQuery('player:stats', { client }));
    expect(query.status).toBe(NuiQueryStatus.Idle);
    expect(query.status).toBe('idle');

    let resolvePromise: (val: any) => void;
    vi.spyOn(client, 'request').mockReturnValue(
      new Promise((res) => {
        resolvePromise = res;
      })
    );

    const execPromise = query.execute();
    expect(query.status).toBe(NuiQueryStatus.Loading);
    expect(query.loading).toBe(true);

    resolvePromise!({ hp: 100 });
    await execPromise;

    expect(query.status).toBe(NuiQueryStatus.Success);
    expect(query.data).toEqual({ hp: 100 });

    // Test Error status
    vi.spyOn(client, 'request').mockRejectedValue(new Error('Network fail'));
    await expect(query.execute()).rejects.toThrow('Network fail');
    expect(query.status).toBe(NuiQueryStatus.Error);

    // Test Reset status
    query.reset();
    expect(query.status).toBe(NuiQueryStatus.Idle);

    // Test Destroy
    query.destroy();
    expect(query.status).toBe(NuiQueryStatus.Idle);

    unmount();
  });

  it('correctly transitions status to Success when C# returns null as response data', async () => {
    vi.spyOn(client, 'request').mockResolvedValueOnce(null);

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('player:nullable', { client })
    );

    expect(query.status).toBe(NuiQueryStatus.Idle);
    await query.execute();

    expect(query.status).toBe(NuiQueryStatus.Success);
    expect(query.data).toBeNull();
    unmount();
  });

  it('refetch retains payload without mutating hasLastRequest or payload state', async () => {
    const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({ ok: true });

    const { query, unmount } = mountQuery(() =>
      useNuiQuery('test:refetch', { client, initialRequest: { page: 1 } })
    );

    await query.refetch();
    expect(requestSpy).toHaveBeenLastCalledWith('test:refetch', { page: 1 }, undefined, expect.any(AbortSignal));

    await query.execute({ page: 2 });
    expect(requestSpy).toHaveBeenLastCalledWith('test:refetch', { page: 2 }, undefined, expect.any(AbortSignal));

    await query.refetch();
    expect(requestSpy).toHaveBeenLastCalledWith('test:refetch', { page: 2 }, undefined, expect.any(AbortSignal));

    unmount();
  });
});
