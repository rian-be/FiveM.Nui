import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SvelteNuiClient } from '../../src/client';
import { setDefaultNuiClient, resetDefaultNuiClient } from '../../src/context';
import { useNuiState } from '../../src/runes/state.svelte';
import { globalErrorHandler } from '@fivem-nui/error';

describe('useNuiState rune', () => {
  let client: SvelteNuiClient;

  beforeEach(() => {
    client = new SvelteNuiClient({ autoInitialize: false });
    setDefaultNuiClient(client);
    globalErrorHandler.clearHistory();
  });

  afterEach(() => {
    client.destroy();
    resetDefaultNuiClient();
    globalErrorHandler.clearHistory();
    vi.restoreAllMocks();
  });

  it('initializes with initialValue and updates reactively on event', () => {
    const state = useNuiState('player:health', 100, { client });
    expect(state.value).toBe(100);
    expect(state.count).toBe(0);
    expect(state.updatedAt).toBeNull();
    expect(state.error).toBeNull();

    // Trigger event
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'player:health', payload: 75 }
      })
    );

    expect(state.value).toBe(75);
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBeTypeOf('number');

    // Manual set & update
    state.set(50);
    expect(state.value).toBe(50);

    state.update((prev) => prev + 10);
    expect(state.value).toBe(60);

    // Value setter
    state.value = 90;
    expect(state.value).toBe(90);

    // Reset
    state.reset();
    expect(state.value).toBe(100);
    expect(state.count).toBe(0);
    expect(state.updatedAt).toBeNull();

    // Destroy
    state.destroy();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'player:health', payload: 10 }
      })
    );
    expect(state.value).toBe(100);
  });

  it('supports transform option and catches non-Error exceptions via onError', () => {
    const onError = vi.fn();
    const state = useNuiState<{ count: number }>(
      'data:update',
      { count: 0 },
      {
        client,
        transform: (raw: any) => {
          if (raw < 0) throw 'Non-error string thrown';
          return { count: raw * 2 };
        },
        onError
      }
    );

    // Valid data
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'data:update', payload: 5 }
      })
    );
    expect(state.value).toEqual({ count: 10 });
    expect(state.error).toBeNull();

    // Non-error thrown in transform
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'data:update', payload: -1 }
      })
    );
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('Non-error string thrown');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    state.destroy();
  });

  it('verifies that manual set() and update() do not modify event metadata (updatedAt and count)', () => {
    const state = useNuiState('metadata:test', 10, { client });
    expect(state.count).toBe(0);
    expect(state.updatedAt).toBeNull();

    // Receive first event
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'metadata:test', payload: 25 }
      })
    );
    expect(state.value).toBe(25);
    expect(state.count).toBe(1);
    const firstUpdatedAt = state.updatedAt;
    expect(firstUpdatedAt).toBeTypeOf('number');

    // Manual set()
    state.set(30);
    expect(state.value).toBe(30);
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBe(firstUpdatedAt);

    // Manual update()
    state.update((v) => v + 5);
    expect(state.value).toBe(35);
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBe(firstUpdatedAt);

    // Direct property assignment
    state.value = 40;
    expect(state.value).toBe(40);
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBe(firstUpdatedAt);

    state.destroy();
  });

  it('handles transform exception, preserves previous value, and recovers on subsequent valid event', () => {
    const onError = vi.fn();
    const state = useNuiState<number>(
      'calc:test',
      100,
      {
        client,
        transform: (raw: any) => {
          if (raw < 0) throw new Error('Value cannot be negative');
          return raw * 2;
        },
        onError
      }
    );

    // Dispatch invalid data -> throws in transform
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'calc:test', payload: -5 }
      })
    );

    // Value must NOT change, error must be set, count and updatedAt remain untouched
    expect(state.value).toBe(100);
    expect(state.error).toBeInstanceOf(Error);
    expect(state.error?.message).toBe('Value cannot be negative');
    expect(state.count).toBe(0);
    expect(state.updatedAt).toBeNull();
    expect(onError).toHaveBeenCalledWith(state.error);

    // Subsequent valid event arrives -> recovers, clears error, updates value and metadata
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'calc:test', payload: 20 }
      })
    );
    expect(state.value).toBe(40);
    expect(state.error).toBeNull();
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBeTypeOf('number');

    state.destroy();
  });

  it('isolates exceptions thrown inside onError callback without crashing event processing', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = useNuiState<number>(
      'crash:test',
      0,
      {
        client,
        transform: () => {
          throw new Error('transform failure');
        },
        onError: () => {
          throw new Error('onError callback crashed');
        }
      }
    );

    // Dispatching event must NOT throw out of the handler
    expect(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'event', event: 'crash:test', payload: 123 }
        })
      );
    }).not.toThrow();

    // Transform error is preserved on state
    expect(state.error?.message).toBe('transform failure');
    // Callback error is caught and logged to console.error
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'onError callback crashed' }));

    consoleErrorSpy.mockRestore();
    state.destroy();
  });

  it('resets state metadata while preserving active event subscription', () => {
    const state = useNuiState('reset:test', 'initial', { client });

    // Receive first event
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'reset:test', payload: 'first-val' }
      })
    );
    expect(state.value).toBe('first-val');
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBeTypeOf('number');

    // Reset back to initial state
    state.reset();
    expect(state.value).toBe('initial');
    expect(state.count).toBe(0);
    expect(state.updatedAt).toBeNull();
    expect(state.error).toBeNull();

    // Verify subscription is still active by sending another event
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'reset:test', payload: 'second-val' }
      })
    );
    expect(state.value).toBe('second-val');
    expect(state.count).toBe(1);
    expect(state.updatedAt).toBeTypeOf('number');

    state.destroy();
  });

  it('supports idempotent manual destroy() and autoDestroy: false option', () => {
    const unsubSpy = vi.fn();
    vi.spyOn(client, 'on').mockReturnValueOnce(unsubSpy);
    const state = useNuiState('destroy:test', 1, { client, autoDestroy: false });

    // Calling destroy multiple times must only call unsubscribe once
    state.destroy();
    state.destroy();
    state.destroy();
    expect(unsubSpy).toHaveBeenCalledTimes(1);

    // Events after destroy are completely ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'destroy:test', payload: 999 }
      })
    );
    expect(state.value).toBe(1);
    expect(state.count).toBe(0);
  });

  it('enforces strict component lifecycle error when autoDestroy: true is used outside a component', () => {
    // In strict mode (autoDestroy: true), calling useNuiState outside component lifecycle must throw
    expect(() => {
      useNuiState('strict:test', 1, { client, autoDestroy: true });
    }).toThrow(/lifecycle/);
  });

  it('reset() reassigns the initial reference without deep cloning (mutations to initialObj persist)', () => {
    const initialObj = { score: 10 };
    const state = useNuiState('object:test', initialObj, { client, autoDestroy: false });

    // Mutate state value by set()
    state.set({ score: 99 });
    expect(state.value).toEqual({ score: 99 });

    // Mutate the original object directly in place
    initialObj.score = 50;

    // Reset restores initialObj (which retains its in-place mutation score: 50)
    state.reset();
    expect(state.value).toEqual(initialObj);
    expect(state.value.score).toBe(50);
    state.destroy();
  });

  it('falls back to useNuiClient() context when client option is omitted', () => {
    const state = useNuiState('context:test', 'default-val');
    expect(state.value).toBe('default-val');

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'context:test', payload: 'context-updated' }
      })
    );
    expect(state.value).toBe('context-updated');
    state.destroy();
  });

  it('captures useNuiState transform failures into globalErrorHandler', () => {
    const state = useNuiState(
      'player:broken',
      { score: 0 },
      {
        client,
        transform: () => {
          throw new Error('Corrupt state payload');
        }
      }
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'player:broken', payload: { corrupt: true } }
      })
    );

    expect(state.error).toBeDefined();
    expect(state.error?.message).toBe('Corrupt state payload');

    const history = globalErrorHandler.getErrorHistory();
    const stateErr = history.find((e) => e.operation === 'useNuiState:transform');
    expect(stateErr).toBeDefined();
    expect(stateErr?.context).toMatchObject({ event: 'player:broken' });
  });
});
