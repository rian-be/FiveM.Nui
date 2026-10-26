import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runInRoot, flushSync } from '../helpers/testHelper.svelte';
import { useLocalStorage } from '../../src/composables/useLocalStorage.svelte';

describe('useLocalStorage composable', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStore[key];
      }),
      clear: vi.fn(() => {
        mockStore = {};
      })
    };

    vi.stubGlobal('localStorage', localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reads initial value when storage is empty', () => {
    const { result: state, cleanup } = runInRoot(() => useLocalStorage('settings:audio', { volume: 80 }));
    flushSync();

    expect(state.current).toEqual({ volume: 80 });
    cleanup();
  });

  it('reads pre-existing JSON value from localStorage', () => {
    mockStore['settings:audio'] = JSON.stringify({ volume: 50 });

    const { result: state, cleanup } = runInRoot(() => useLocalStorage('settings:audio', { volume: 80 }));
    flushSync();

    expect(state.current).toEqual({ volume: 50 });
    cleanup();
  });

  it('updates memory state and writes to localStorage on assignment and set()', () => {
    const { result: state, cleanup } = runInRoot(() => useLocalStorage('counter', 10));
    flushSync();

    state.current = 20;
    flushSync();

    expect(state.current).toBe(20);
    expect(JSON.parse(mockStore['counter'])).toBe(20);

    state.set((prev) => prev + 5);
    flushSync();

    expect(state.current).toBe(25);
    expect(JSON.parse(mockStore['counter'])).toBe(25);

    cleanup();
  });

  it('synchronizes when cross-window storage event fires', () => {
    const { result: state, cleanup } = runInRoot(() => useLocalStorage('theme', 'dark'));
    flushSync();

    expect(state.current).toBe('dark');

    // Simulate external window storage event
    mockStore['theme'] = JSON.stringify('light');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'theme',
        newValue: JSON.stringify('light')
      })
    );
    flushSync();

    expect(state.current).toBe('light');

    // Simulate storage item removal
    delete mockStore['theme'];
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'theme',
        newValue: null
      })
    );
    flushSync();

    expect(state.current).toBe('dark');

    cleanup();
  });
});
