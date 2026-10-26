import { describe, it, expect, vi, afterEach } from 'vitest';
import { runInRoot, flushSync } from '../helpers/testHelper.svelte';
import { useIdle, useIdleUntil } from '../../src/composables/useIdle.svelte';

describe('useIdle composable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('transitions to idle after specified timeout and wakes up on user activity', () => {
    vi.useFakeTimers();

    const { result: state, cleanup } = runInRoot(() => useIdle(5000, 1000));
    flushSync();

    expect(state.isIdle).toBe(false);

    vi.advanceTimersByTime(5100);
    flushSync();

    expect(state.isIdle).toBe(true);

    // User activity: pointerdown event
    window.dispatchEvent(new Event('pointerdown'));
    flushSync();

    expect(state.isIdle).toBe(false);

    cleanup();
  });

  it('supports manual reset(force)', () => {
    vi.useFakeTimers();

    const { result: state, cleanup } = runInRoot(() => useIdle(5000, 1000));
    flushSync();

    vi.advanceTimersByTime(3000);
    state.reset(true);

    vi.advanceTimersByTime(3000);
    flushSync();

    expect(state.isIdle).toBe(false);

    vi.advanceTimersByTime(2100);
    flushSync();

    expect(state.isIdle).toBe(true);

    cleanup();
  });

  it('useIdleUntil triggers callback once when timeout expires', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const { cleanup } = runInRoot(() => useIdleUntil(2000, callback));
    flushSync();

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2100);
    flushSync();

    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
