<script lang="ts">
  import {
    useClickOutside,
    type ClickOutsideInput
  } from '../../src/composables/useClickOutside';

  interface Props {
    targetEl: () => HTMLElement | null | undefined;
    options: ClickOutsideInput | (() => ClickOutsideInput);
  }

  let props: Props = $props();

  // svelte-ignore state_referenced_locally
  useClickOutside(props.targetEl, props.options);
</script>

<div data-testid="click-outside-host"></div>
