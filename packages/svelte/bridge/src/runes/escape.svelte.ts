import { untrack } from 'svelte';
import {
  createEscapeHandler,
  toEscapeOptions,
  type NuiEscapeParameter,
  NuiEscapeTarget
} from '../actions/escape';

export { NuiEscapeTarget };

export type NuiEscapeComposableParameter = Omit<NuiEscapeParameter, 'target'> & {
  /**
   * Where to attach the global listener:
   * - `'document'` / `NuiEscapeTarget.Document`: listens globally on the document (default)
   * - `'window'` / `NuiEscapeTarget.Window`: listens globally on the window
   *
   * Note: To scope Escape to a specific DOM element with focus, use the `nuiEscapeAction` action instead.
   * @defaultValue NuiEscapeTarget.Document
   */
  target?: NuiEscapeTarget.Window | NuiEscapeTarget.Document;
};

export type NuiEscapeComposableInput =
  | ((event: KeyboardEvent) => void)
  | NuiEscapeComposableParameter;

/**
 * Listens for the Escape key and invokes a callback.
 * Automatically cleans up listeners on unmount.
 *
 * @param getOptions - Getter returning options or an onEscape callback.
 *
 * @example
 * ```svelte
 * <script>
 *   let isOpen = $state(false);
 *
 *   useEscape(() => ({
 *     onEscape: () => { isOpen = false; },
 *     enabled: isOpen
 *   }));
 * </script>
 * ```
 */
export function useEscape(
  getOptions: () => NuiEscapeComposableInput
): void {
  const normalized = () => toEscapeOptions<NuiEscapeComposableParameter>(getOptions());
  const handler = createEscapeHandler(normalized);

  $effect(() => {
    // Intentionally untracked: attach the DOM listener once upon mount,
    // preserving event listener order. Reactive state (`enabled`, `onEscape`, etc.)
    // is read lazily on each keydown event. Cleanup is called on component unmount.
    const { target, capture } = untrack(() => {
      const o = normalized();
      return {
        target: o?.target === NuiEscapeTarget.Window ? window : document,
        capture: o?.capture ?? false
      };
    });

    const ac = new AbortController();
    target.addEventListener('keydown', handler as EventListener, {
      capture,
      signal: ac.signal
    });

    return () => ac.abort();
  });
}
