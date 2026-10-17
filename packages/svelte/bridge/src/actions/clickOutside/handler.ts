import type { ClickOutsideTarget, NuiClickOutsideParameter } from './types';

/**
 * Resolves a DOM Element from an Element reference, CSS selector string, or getter function.
 */
export function resolveElement(target: ClickOutsideTarget): Element | null {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  if (typeof target === 'function') {
    return target() ?? null;
  }
  return target ?? null;
}

/**
 * Creates a reusable pointerdown event handler for outside click detection.
 * Shared between Svelte action and composable to eliminate duplication.
 */
export function createClickOutsideHandler(
  getNode: () => Element | null | undefined,
  getOptions: () => NuiClickOutsideParameter | undefined
) {
  return (event: PointerEvent) => {
    const node = getNode();
    const opts = getOptions();
    if (!node?.isConnected || !opts) return;

    const enabled = typeof opts.enabled === 'function' ? opts.enabled() : opts.enabled ?? true;
    if (!enabled || event.button !== 0) return;

    const path = event.composedPath();
    if (path.includes(node)) return;

    for (const item of opts.ignore ?? []) {
      const el = resolveElement(item);
      if (el && path.includes(el)) return;
    }

    const callback = opts.onClickOutside ?? opts.callback;
    if (callback) {
      try {
        callback(event);
      } catch (err) {
        console.error('[NuiClickOutside] Error in onClickOutside callback:', err);
      }
    }
  };
}
