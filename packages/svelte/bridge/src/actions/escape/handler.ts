import { NuiEscapeTarget, type NuiEscapeParameter } from './types';

/**
 * Resolves the appropriate EventTarget to attach the Escape key listener to.
 */
export function resolveTarget(node: HTMLElement, targetType?: NuiEscapeTarget): EventTarget {
  if (targetType === NuiEscapeTarget.Window) return window;
  if (targetType === NuiEscapeTarget.Element) return node;
  return document;
}

/**
 * Creates a reusable keydown event handler for Escape key detection.
 * Shared between Svelte action and composable to eliminate duplication.
 */
export function createEscapeHandler(
  getOptions: () => NuiEscapeParameter | undefined
) {
  return (event: KeyboardEvent) => {
    const opts = getOptions();
    if (!opts || event.key !== 'Escape' || event.isComposing) return;

    if (opts.ignoreHandled && event.defaultPrevented) return;

    const enabled = typeof opts.enabled === 'function' ? opts.enabled() : opts.enabled ?? true;
    const handler = opts.onEscape ?? opts.callback;
    if (!enabled || !handler) return;

    if ((opts.ignoreRepeat ?? true) && event.repeat) {
      if (opts.preventDefault ?? true) {
        event.preventDefault();
      }
      return;
    }

    if (opts.preventDefault ?? true) {
      event.preventDefault();
    }
    if (opts.stopPropagation) {
      event.stopPropagation();
    }
    if (opts.stopImmediatePropagation) {
      event.stopImmediatePropagation();
    }

    try {
      handler(event);
    } catch (err) {
      console.error('[NuiEscape] Error in onEscape callback:', err);
    }
  };
}
