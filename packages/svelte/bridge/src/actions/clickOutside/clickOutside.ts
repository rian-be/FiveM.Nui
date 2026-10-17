import type { Action } from 'svelte/action';
import {
  type NuiClickOutsideInput,
  toClickOutsideOptions
} from './types';
import { createClickOutsideHandler } from './handler';

/**
 * Svelte Action for reliable outside click detection in FiveM CEF.
 *
 * Uses `event.composedPath()` to eliminate the detached DOM node bug when
 * inner elements mutate during click events.
 *
 * @remarks
 * **Multiple Overlays in CEF**:
 * Because `pointerdown` is used with `capture: true`, clicking into another open NUI panel
 * will trigger an outside click unless that other panel is explicitly included in `ignore`.
 *
 * @param node - The DOM element to monitor for outside clicks.
 * @param parameter - Callback function or configuration options object.
 *
 * @example
 * ```svelte
 * <div use:nuiClickOutside={() => (isOpen = false)}>...</div>
 * <div use:nuiClickOutside={{ onClickOutside: close, ignore: [triggerEl, '.header-btn'] }}>...</div>
 * ```
 */
export const nuiClickOutside: Action<HTMLElement, NuiClickOutsideInput> = (
  node,
  parameter
) => {
  let currentParam = parameter;
  let controller: AbortController | null = null;

  const handler = createClickOutsideHandler(
    () => node,
    () => toClickOutsideOptions(currentParam)
  );

  function getCapture(): boolean {
    const opts = toClickOutsideOptions(currentParam);
    return opts?.capture ?? true;
  }

  function setup() {
    teardown();
    controller = new AbortController();
    document.addEventListener('pointerdown', handler, {
      capture: getCapture(),
      signal: controller.signal
    });
  }

  function teardown() {
    if (controller) {
      controller.abort();
      controller = null;
    }
  }

  setup();

  return {
    update(newParam) {
      const prevCapture = getCapture();
      currentParam = newParam;
      // Only changes to `capture` require re-binding the document listener.
      // All other options (`enabled`, `onClickOutside`, `ignore`)
      // are read lazily on each pointerdown event via getOptions().
      if (getCapture() !== prevCapture) {
        setup();
      }
    },
    destroy() {
      teardown();
    }
  };
};
