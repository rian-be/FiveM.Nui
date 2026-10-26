import { flushSync as svelteFlushSync } from 'svelte';

export function flushSync(): void {
  svelteFlushSync();
}

/**
 * Creates a reactive two-way binding bridge for test mounts.
 * Tracks reads and writes via Svelte 5 $state runes so $effect and templates update reactively.
 */
export function bindState<T>(initialValue: T) {
  let internal = $state(initialValue);
  return {
    get current() {
      return internal;
    },
    set current(v: T) {
      internal = v;
    }
  };
}

export function runInRoot<T>(fn: () => T): { result: T; cleanup: () => void } {
  let result!: T;
  const cleanup = $effect.root(() => {
    result = fn();
  });
  return { result, cleanup };
}
