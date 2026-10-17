/**
 * LocalStorage synchronization hook for FiveM NUI.
 */
export interface LocalStorageState<T> {
  get current(): T;
  set current(value: T);
  set(value: T | ((prev: T) => T)): void;
}

const STORAGE_EVENT_PREFIX = 'nui-local-storage:';

/**
 * LocalStorage synchronization hook.
 * 
 * Automatically synchronizes state with `localStorage`, listens for cross-window 
 * `storage` events (including removals/clears), and dispatches custom events with 
 * source filtering for intra-window CEF (FiveM NUI) synchronization.
 * 
 * Note: 
 * - Must be called within a component initialization context (or wrapped in `$effect.root`).
 * - Mutating nested properties of objects directly (e.g. `state.current.prop = val`) does not trigger a write; use assignments or `.set()`.
 * - If the key changes dynamically, the state switches to the new key, overwriting uncommitted state.
 * - Write failures (e.g., storage quota exceeded) keep the memory state updated while leaving storage unchanged.
 */
export function useLocalStorage<T>(
  key: string | (() => string),
  initialValue: T
): LocalStorageState<T> {
  // Helper to resolve reactive or static key
  const resolveKey = () => (typeof key === 'function' ? key() : key);

  function cloneInitial(): T {
    if (initialValue === undefined) return initialValue as T;
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(initialValue);
      }
      return JSON.parse(JSON.stringify(initialValue));
    } catch {
      return initialValue;
    }
  }

  function readStorage(targetKey: string): T {
    try {
      const item = window.localStorage.getItem(targetKey);
      if (item !== null) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.warn(`[nui-local-storage] Error reading key "${targetKey}":`, error);
    }
    return cloneInitial();
  }

  // Synchronous initial read to prevent flash of default value on first render
  let stored = $state<T>(readStorage(resolveKey()));
  let loadedKey = resolveKey();
  const instanceId = Symbol();

  function setValue(value: T | ((prev: T) => T)) {
    const currentKey = resolveKey();
    const valueToStore = typeof value === 'function' ? (value as (prev: T) => T)(stored) : value;
    stored = valueToStore;

    try {
      window.localStorage.setItem(currentKey, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`[nui-local-storage] Error writing key "${currentKey}":`, error);
      return; // Memory state is updated, but storage write failed
    }

    // Dispatch custom event for intra-window CEF synchronization (critical for FiveM NUI) only after successful write
    try {
      window.dispatchEvent(
        new CustomEvent(`${STORAGE_EVENT_PREFIX}${currentKey}`, {
          detail: { source: instanceId }
        })
      );
    } catch (error) {
      console.warn(`[nui-local-storage] Error dispatching sync event for key "${currentKey}":`, error);
    }
  }

  const setupEffect = () => {
    const currentKey = resolveKey();

    // Sync state only if the key has actually changed (prevents double parsing on initial mount)
    if (currentKey !== loadedKey) {
      loadedKey = currentKey;
      stored = readStorage(currentKey);
    }

    const controller = new AbortController();
    const { signal } = controller;

    // 1. Cross-window storage events (handles external tabs, clear(), removeItem())
    window.addEventListener(
      'storage',
      (event: StorageEvent) => {
        if (event.key === currentKey || event.key === null) {
          stored = readStorage(currentKey);
        }
      },
      { signal }
    );

    // 2. Intra-window custom events (FiveM NUI CEF synchronization with fresh storage reads)
    window.addEventListener(
      `${STORAGE_EVENT_PREFIX}${currentKey}`,
      (event: Event) => {
        const customEvent = event as CustomEvent<{ source: symbol }>;
        if (customEvent.detail.source !== instanceId) {
          stored = readStorage(currentKey);
        }
      },
      { signal }
    );

    return () => {
      controller.abort();
    };
  };

  // Reactive lifecycle management for dynamic keys
  $effect(setupEffect);

  return {
    get current() {
      return stored;
    },
    set current(val: T) {
      setValue(val);
    },
    set: setValue
  };
}