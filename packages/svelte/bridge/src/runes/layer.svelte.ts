import { untrack } from 'svelte';
import {
  nuiLayer,
  NuiLayerDismissReason,
  type NuiLayerInput,
  type NuiLayerOptions,
  type LayerInstance
} from '../actions/layer';

export {
  NuiLayerDismissReason
};

export type {
  NuiLayerInput,
  NuiLayerOptions,
  LayerInstance
};

/**
 * Reactive options getter for `useLayer`.
 */
export type NuiLayerComposableInput = () => NuiLayerOptions;

/**
 * Manages an overlay layer (modal, dialog, drawer) in FiveM NUI.
 * Coordinates Escape key, outside click, and focus trapping through a central layer stack.
 *
 * @param target - Getter returning the container element.
 * @param getOptions - Optional getter returning layer options.
 *
 * @example
 * ```svelte
 * <script>
 *   let modalEl = $state<HTMLElement>();
 *   let isOpen = $state(false);
 *
 *   useLayer(
 *     () => modalEl,
 *     () => ({ onDismiss: () => { isOpen = false; }, enabled: isOpen })
 *   );
 * </script>
 *
 * {#if isOpen}
 *   <div bind:this={modalEl} class="modal">
 *     <h2>Modal</h2>
 *     <button onclick={() => { isOpen = false; }}>Close</button>
 *   </div>
 * {/if}
 * ```
 */
export function useLayer(
  target: () => HTMLElement | null | undefined,
  getOptions?: () => NuiLayerOptions
): void {
  let action: ReturnType<typeof nuiLayer> | undefined;

  $effect(() => {
    const node = target();
    if (!node) return;

    action = nuiLayer(node, untrack(() => getOptions?.()));

    return () => {
      action?.destroy?.();
      action = undefined;
    };
  });

  $effect(() => {
    const opts = getOptions?.();
    action?.update?.(opts);
  });
}
