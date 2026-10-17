<script lang="ts">
  import {
    useKeyboardShortcut,
    useKeyboardShortcuts,
    type KeyboardShortcutSource,
    type KeyboardShortcutsSource,
    type KeyboardShortcutOptions,
  } from "../../src/composables/useKeyboardShortcut.svelte";

  interface Props {
    shortcuts?: KeyboardShortcutsSource;
    singleShortcut?: KeyboardShortcutSource;
    options?: KeyboardShortcutOptions;
  }

  let props: Props = $props();

  // svelte-ignore state_referenced_locally
  if (props.shortcuts !== undefined) {
    useKeyboardShortcuts(props.shortcuts, props.options);
  }

  // svelte-ignore state_referenced_locally
  if (props.singleShortcut !== undefined) {
    useKeyboardShortcut(props.singleShortcut, props.options);
  }
</script>

<div data-testid="keyboard-host"></div>
