import { untrack } from 'svelte';
import {
  createClickOutsideHandler,
  type ClickOutsideTarget,
  type NuiClickOutsideParameter
} from '../actions/clickOutside';

export type { ClickOutsideTarget, NuiClickOutsideParameter };

/**
 * Detects clicks outside a target element and invokes a callback.
 * Automatically cleans up listeners on unmount.
 *
 * @param target - Getter returning the target DOM element.
 * @param getOptions - Getter returning options (onClickOutside, ignore, enabled).
 *
 * @example
 * ```svelte
 * <script>
 *   let panelEl = $state<HTMLElement>();
 *   let triggerEl = $state<HTMLElement>();
 *   let isOpen = $state(false);
 *
 *   useClickOutside(
 *     () => panelEl,
 *     () => ({
 *       onClickOutside: () => { isOpen = false; },
 *       ignore: [triggerEl],
 *       enabled: isOpen
 *     })
 *   );
 * </script>
 * ```
 */
export function useClickOutside(
  target: () => Element | null | undefined,
  getOptions: () => NuiClickOutsideParameter
): void {
  const handler = createClickOutsideHandler(target, getOptions);

  $effect(() => {
    if (!target()) return;

    const capture = untrack(() => getOptions().capture ?? true);
    const ac = new AbortController();
    document.addEventListener('pointerdown', handler, {
      capture,
      signal: ac.signal
    });

    return () => ac.abort();
  });
}
