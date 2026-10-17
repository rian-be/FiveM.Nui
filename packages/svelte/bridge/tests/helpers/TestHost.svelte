<script lang="ts">
  import { useEscape, type NuiEscapeComposableInput } from '../../src/runes/escape.svelte';
  import { useClickOutside, type NuiClickOutsideParameter } from '../../src/runes/clickOutside.svelte';
  import { useFocusTrap, type NuiFocusTrapInput } from '../../src/runes/focusTrap.svelte';
  import { useLayer, type NuiLayerComposableInput } from '../../src/runes/layer.svelte';
  import { useNuiState } from '../../src/runes/state.svelte';
  import { useNuiQuery } from '../../src/runes/query.svelte';
  import { useNuiWindow } from '../../src/runes/window.svelte';

  interface Props {
    containerEl?: HTMLElement | null;
    escapeOptions?: () => NuiEscapeComposableInput;
    clickOutsideTarget?: () => Element | null | undefined;
    clickOutsideOptions?: () => NuiClickOutsideParameter;
    trapTarget?: () => HTMLElement | null | undefined;
    trapOptions?: () => NuiFocusTrapInput;
    layerTarget?: () => HTMLElement | null | undefined;
    layerOptions?: NuiLayerComposableInput;
    mountLifecycleRunes?: boolean;
    queryFactory?: () => void;
    exposed?: Record<string, any>;
    controller?: Record<string, any>;
  }

  let props = $props<Props>();
  let localContainer = $state<HTMLElement | null>(null);

  if (props.queryFactory) {
    props.queryFactory();
  }

  let dynamicLayerTarget = $state<HTMLElement | null | undefined>(undefined);
  let dynamicLayerEnabled = $state<boolean | undefined>(undefined);

  if (props.controller) {
    props.controller.setLayerTarget = (node: HTMLElement | null) => {
      dynamicLayerTarget = node;
    };
    props.controller.setLayerEnabled = (val: boolean) => {
      dynamicLayerEnabled = val;
    };
  }

  if (props.escapeOptions) {
    useEscape(props.escapeOptions);
  }

  if (props.clickOutsideOptions) {
    useClickOutside(
      props.clickOutsideTarget ?? (() => localContainer),
      props.clickOutsideOptions
    );
  }

  if (props.trapOptions) {
    useFocusTrap(
      props.trapTarget ?? (() => localContainer),
      props.trapOptions
    );
  }

  if (props.layerOptions !== undefined) {
    useLayer(
      () => {
        if (dynamicLayerTarget !== undefined) return dynamicLayerTarget;
        return props.layerTarget ? props.layerTarget() : localContainer;
      },
      () => {
        const opts = props.layerOptions!();
        if (dynamicLayerEnabled !== undefined) {
          return { ...opts, enabled: dynamicLayerEnabled };
        }
        return opts;
      }
    );
  }

  if (props.mountLifecycleRunes) {
    const state = useNuiState('lifecycle:state', 1);
    const query = useNuiQuery('lifecycle:query');
    const win = useNuiWindow('lifecycle:win', { closeOnEscape: true });
    if (props.exposed) {
      props.exposed.state = state;
      props.exposed.query = query;
      props.exposed.win = win;
    }
  }
</script>

<div bind:this={localContainer} id="hostContainer">
  <button id="hostBtn">Host Button</button>
  <button id="hostBtn2">Second Button</button>
</div>
