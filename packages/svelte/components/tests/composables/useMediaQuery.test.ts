import { describe, it, expect, vi, afterEach } from 'vitest';
import { runInRoot, bindState, flushSync } from '../helpers/testHelper.svelte';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useDarkMode,
  useReducedMotion,
  useHighContrast
} from '../../src/composables/useMediaQuery.svelte';

describe('useMediaQuery and breakpoint composables', () => {
  let listeners: ((event: MediaQueryListEvent) => void)[] = [];
  let currentMatches = false;

  function setupMatchMedia(initial = false) {
    currentMatches = initial;
    listeners = [];

    const mql = {
      get matches() {
        return currentMatches;
      },
      addEventListener: vi.fn((type: string, listener: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.push(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: (e: MediaQueryListEvent) => void) => {
        if (type === 'change') {
          listeners = listeners.filter((l) => l !== listener);
        }
      })
    };

    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    return mql;
  }

  function triggerMediaChange(next: boolean) {
    currentMatches = next;
    listeners.forEach((l) => l({ matches: next } as MediaQueryListEvent));
    flushSync();
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('initializes matches from window.matchMedia and updates on change event', () => {
    setupMatchMedia(false);

    const { result: state, cleanup } = runInRoot(() => useMediaQuery('(min-width: 800px)'));
    flushSync();

    expect(state.matches).toBe(false);

    triggerMediaChange(true);
    expect(state.matches).toBe(true);

    cleanup();
  });

  it('cleans up event listener on effect root destruction', () => {
    const mql = setupMatchMedia(true);

    const { cleanup } = runInRoot(() => useMediaQuery('(max-width: 600px)'));
    flushSync();

    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    cleanup();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('supports reactive query getter', () => {
    setupMatchMedia(false);

    const queryState = bindState('(width < 500px)');
    const { result: state, cleanup } = runInRoot(() => useMediaQuery(() => queryState.current));
    flushSync();

    expect(state.matches).toBe(false);

    queryState.current = '(width < 900px)';
    flushSync();

    cleanup();
  });

  it('provides convenience helpers for breakpoints and accessibility preferences', () => {
    setupMatchMedia(true);

    const { cleanup } = runInRoot(() => {
      expect(useIsMobile().matches).toBe(true);
      expect(useIsTablet().matches).toBe(true);
      expect(useIsDesktop().matches).toBe(true);
      expect(useDarkMode().matches).toBe(true);
      expect(useReducedMotion().matches).toBe(true);
      expect(useHighContrast().matches).toBe(true);
    });
    flushSync();

    cleanup();
  });
});
