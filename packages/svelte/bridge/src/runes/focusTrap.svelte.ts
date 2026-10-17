import { untrack } from 'svelte';
import {
  nuiFocusTrap,
  type NuiFocusTrapInput,
  type NuiFocusTrapOptions,
  type FocusTrapAllowOutsideTarget,
  type FocusTrapAllowOutside
} from '../actions/focusTrap';

export type {
  NuiFocusTrapInput,
  NuiFocusTrapOptions,
  FocusTrapAllowOutsideTarget,
  FocusTrapAllowOutside
};

/**
 * Traps Tab key navigation inside a container element.
 * Automatically activates and tears down as the target element mounts/unmounts.
 *
 * @param target - Getter returning the container element.
 * @param getOptions - Optional getter returning options or boolean enabled flag.
 *
 * @example
 * ```svelte
 * <script>
 *   let modalEl = $state<HTMLElement>();
 *   let isOpen = $state(false);
 *
 *   useFocusTrap(() => modalEl, () => isOpen);
 * </script>
 * ```
 */
export function useFocusTrap(
  target: () => HTMLElement | null | undefined,
  getOptions?: () => NuiFocusTrapInput
): void {
  let action: ReturnType<typeof nuiFocusTrap> | undefined;

  $effect(() => {
    const node = target();
    if (!node) return;

    action = nuiFocusTrap(node, untrack(() => getOptions?.() ?? true));

    return () => {
      action?.destroy?.();
      action = undefined;
    };
  });

  $effect(() => {
    const opts = getOptions?.() ?? true;
    action?.update?.(opts);
  });
}
