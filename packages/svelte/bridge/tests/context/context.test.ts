import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as svelte from 'svelte';
import {
  setNuiClient,
  useNuiClient,
  setDefaultNuiClient,
  getDefaultNuiClient,
  resetDefaultNuiClient,
  NUI_CONTEXT_KEY
} from '../../src/context';
import { SvelteNuiClient } from '../../src/client';

vi.mock('svelte', async (importOriginal) => {
  const actual = await importOriginal<typeof import('svelte')>();
  return {
    ...actual,
    hasContext: vi.fn(),
    getContext: vi.fn(),
    setContext: vi.fn()
  };
});

describe('context / useNuiClient', () => {
  beforeEach(() => {
    resetDefaultNuiClient();
    vi.mocked(svelte.hasContext).mockReset();
    vi.mocked(svelte.getContext).mockReset();
  });

  afterEach(() => {
    resetDefaultNuiClient();
    vi.restoreAllMocks();
  });

  it('scoped component context wins over explicit fallbackClient and global default', () => {
    const scopedClient = new SvelteNuiClient();
    const fallbackClient = new SvelteNuiClient();
    const globalClient = new SvelteNuiClient();
    setDefaultNuiClient(globalClient);

    // Simulate being inside a Svelte component with setNuiClient() in parent
    vi.mocked(svelte.hasContext).mockImplementation((key) => key === NUI_CONTEXT_KEY);
    vi.mocked(svelte.getContext).mockImplementation((key) => {
      if (key === NUI_CONTEXT_KEY) return scopedClient;
      return undefined;
    });

    const result = useNuiClient(fallbackClient);
    expect(result).toBe(scopedClient);
    expect(result).not.toBe(fallbackClient);
    expect(result).not.toBe(globalClient);
  });

  it('provides client to child components via setNuiClient', () => {
    const client = new SvelteNuiClient();
    const result = setNuiClient(client);
    expect(result).toBe(client);
    expect(svelte.setContext).toHaveBeenCalledWith(NUI_CONTEXT_KEY, client);
  });

  it('safely falls back to explicit fallbackClient when outside component lifecycle', () => {
    const fallbackClient = new SvelteNuiClient();
    const globalClient = new SvelteNuiClient();
    setDefaultNuiClient(globalClient);

    // Calling outside component initialization: Svelte's hasContext throws
    const resolved = useNuiClient(fallbackClient);
    expect(resolved).toBe(fallbackClient);
    expect(resolved).not.toBe(globalClient);
  });

  it('safely falls back to global default client outside component lifecycle when no fallbackClient given', () => {
    const globalClient = new SvelteNuiClient();
    setDefaultNuiClient(globalClient);

    expect(() => useNuiClient()).not.toThrow();
    expect(useNuiClient()).toBe(globalClient);
  });

  it('throws helpful error message when no client is available anywhere', () => {
    resetDefaultNuiClient();

    expect(() => useNuiClient()).toThrowError(
      '[fivem-nui-svelte] No NuiClient available. Call setNuiClient(client) in a parent component, provide an explicit client argument to useNuiClient(fallback), or register a default client via setDefaultNuiClient(client) at startup.'
    );
  });

  it('shares defaultClientInstance on globalThis via Symbol.for across package copies', () => {
    const client = new SvelteNuiClient();
    setDefaultNuiClient(client);

    const globalSymbol = Symbol.for('@fivem-nui/svelte:default-client');
    const stored = (globalThis as any)[globalSymbol];
    expect(stored).toBe(client);

    resetDefaultNuiClient();
    expect((globalThis as any)[globalSymbol]).toBeNull();
  });

  it('setDefaultNuiClient warns when replacing client in non-HMR environment', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const client1 = new SvelteNuiClient();
    const result1 = setDefaultNuiClient(client1);
    expect(result1).toBe(client1);
    expect(warnSpy).not.toHaveBeenCalled();

    // Calling again with the SAME instance does not warn
    setDefaultNuiClient(client1);
    expect(warnSpy).not.toHaveBeenCalled();

    // Calling with a DIFFERENT instance warns
    const client2 = new SvelteNuiClient();
    const result2 = setDefaultNuiClient(client2);
    expect(result2).toBe(client2);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('while a default client was already registered')
    );
  });

  it('getDefaultNuiClient returns the registered default client or null', () => {
    expect(getDefaultNuiClient()).toBeNull();

    const client = new SvelteNuiClient();
    setDefaultNuiClient(client);
    expect(getDefaultNuiClient()).toBe(client);
  });
});
