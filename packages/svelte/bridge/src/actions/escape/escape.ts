import type { Action } from 'svelte/action';
import {
  type NuiEscapeInput,
  toEscapeOptions
} from './types';
import { resolveTarget, createEscapeHandler } from './handler';

/**
 * Svelte Action for handling Escape key presses in FiveM NUI.
 *
 * Designed specifically for FiveM NUI where Escape is the universal close/dismiss action.
 * Defaults to listening on `document` so closing works without requiring focus on a specific `div`.
 *
 * @remarks
 * **Nested Modals & Target Scoping**:
 * When using `target: NuiEscapeTarget.Document` (default), all registered listeners on `document` will receive
 * keydown in registration order. If you have nested modals where only the topmost modal should close,
 * consider using `nuiLayer` (which manages a centralized layer stack so only the topmost active layer dismisses),
 * or configure `ignoreHandled: true`, or use `target: NuiEscapeTarget.Element` with a focus trap (`nuiFocusTrap`) and `stopPropagation: true`.
 *
 * @param node - The DOM element attaching the action.
 * @param parameter - Callback function or configuration options object.
 *
 * @example
 * ```svelte
 * <div use:nuiEscapeAction={() => win.close()}>...</div>
 * <div use:nuiEscapeAction={{ onEscape: close, stopPropagation: true }}>...</div>
 * ```
 */
export const nuiEscapeAction: Action<HTMLElement, NuiEscapeInput> = (
  node,
  parameter
) => {
  let currentParam = parameter;
  let controller: AbortController | null = null;

  const handler = createEscapeHandler(() => toEscapeOptions(currentParam));

  function getTarget(): EventTarget {
    const opts = toEscapeOptions(currentParam);
    return resolveTarget(node, opts?.target);
  }

  function getCapture(): boolean {
    const opts = toEscapeOptions(currentParam);
    return opts?.capture ?? false;
  }

  function setup() {
    teardown();
    const eventTarget = getTarget();
    controller = new AbortController();
    eventTarget.addEventListener('keydown', handler as EventListener, {
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
      const prevOpts = toEscapeOptions(currentParam);
      currentParam = newParam;
      const nextOpts = toEscapeOptions(currentParam);

      const prevTarget = resolveTarget(node, prevOpts?.target);
      const nextTarget = resolveTarget(node, nextOpts?.target);
      const prevCapture = prevOpts?.capture ?? false;
      const nextCapture = nextOpts?.capture ?? false;

      // Only target or capture changes require re-binding DOM listeners.
      // Other options (enabled, onEscape, preventDefault, stopPropagation, ignoreRepeat)
      // are read dynamically inside createEscapeHandler on each keydown event.
      if (prevTarget !== nextTarget || prevCapture !== nextCapture) {
        setup();
      }
    },
    destroy() {
      teardown();
    }
  };
};
