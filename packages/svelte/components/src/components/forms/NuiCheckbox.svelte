<!--
  @component NuiCheckbox
  Accessible toggle checkbox component with FiveM NUI event synchronization,
  intermediate state support, and keyboard accessibility.
-->
<script lang="ts">
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  interface Props {
    /** Optional HTML id attribute. Defaults to a unique generated id via $props.id(). */
    id?: string;
    /** Current checked state. Supports two-way binding. */
    value?: boolean;
    /** Text label displayed next to checkbox. */
    label?: string;
    /** Secondary description text displayed below label. */
    description?: string;
    /** Accessible label for screen readers when visual label is omitted. */
    ariaLabel?: string;
    /** Whether checkbox is in an indeterminate state. Supports two-way binding. */
    indeterminate?: boolean;
    /** Whether checkbox is disabled. */
    disabled?: boolean;
    /** Form input name attribute. */
    name?: string;
    /** Default NUI event name sent on any state change. */
    eventName?: string;
    /** NUI event name sent specifically when checked (overrides eventName). */
    onCheck?: string;
    /** NUI event name sent specifically when unchecked (overrides eventName). */
    onUncheck?: string;
    /** Optional change callback fired on state toggle. */
    onChange?: (checked: boolean) => void;
    /** SvelteNuiClient instance for event transport. */
    client?: SvelteNuiClient;
  }

  const autoId = $props.id();

  let {
    id,
    eventName = '',
    client = nui,
    value = $bindable(false),
    label = '',
    description = '',
    ariaLabel,
    disabled = false,
    indeterminate = $bindable(false),
    onCheck = '',
    onUncheck = '',
    onChange,
    name = ''
  }: Props = $props();

  let element = $state<HTMLInputElement | undefined>(undefined);

  const inputId = $derived(id || autoId);
  const descId = $derived(description ? `${inputId}-desc` : undefined);
  const resolvedAriaLabel = $derived(!label ? (ariaLabel || 'Checkbox') : undefined);

  $effect(() => {
    if (element) {
      element.indeterminate = indeterminate;
    }
  });

  function handleChange(event: Event) {
    if (disabled) return;
    const next = (event.currentTarget as HTMLInputElement).checked;
    indeterminate = false;
    value = next;

    const targetEvent = next ? (onCheck || eventName) : (onUncheck || eventName);
    if (targetEvent) {
      try {
        client.send(targetEvent, { value: next });
      } catch (err) {
        console.error(
          `[fivem-nui-components] Failed to send checkbox event '${targetEvent}':`,
          err
        );
      }
    }

    onChange?.(next);
  }
</script>

<label class="nui-checkbox" class:is-disabled={disabled} for={inputId}>
  <input
    bind:this={element}
    id={inputId}
    class="nui-checkbox__input"
    type="checkbox"
    checked={value}
    {disabled}
    {name}
    aria-label={resolvedAriaLabel}
    aria-describedby={descId}
    onchange={handleChange}
  />
  <span
    class="nui-checkbox__track"
    class:checked={value}
    class:indeterminate={indeterminate}
    aria-hidden="true"
  >
    <span class="nui-checkbox__thumb"></span>
  </span>
  {#if label || description}
    <span class="nui-checkbox__text">
      {#if label}<span class="nui-checkbox__label">{label}</span>{/if}
      {#if description}<span id={descId} class="nui-checkbox__description">{description}</span>{/if}
    </span>
  {/if}
</label>

<style>
  .nui-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    user-select: none;
    font-family: inherit;
    color: var(--nui-fg, #fafafa);
    vertical-align: middle;
  }

  .nui-checkbox.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nui-checkbox__input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    margin: 0;
    padding: 0;
    pointer-events: none;
  }

  .nui-checkbox__track {
    position: relative;
    flex: none;
    width: 2.25rem;
    height: 1.25rem;
    padding: 0.125rem;
    border-radius: 999px;
    background: var(--nui-surface-alt, #3f3f46);
    border: 1px solid var(--nui-border, #52525b);
    transition: background 0.2s ease, border-color 0.2s ease;
    box-sizing: border-box;
  }

  .nui-checkbox__input:focus-visible + .nui-checkbox__track {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 3px;
  }

  .nui-checkbox__input:checked + .nui-checkbox__track,
  .nui-checkbox__track.checked {
    background: var(--nui-primary, #3b82f6);
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-checkbox__input:indeterminate + .nui-checkbox__track,
  .nui-checkbox__track.indeterminate {
    background: var(--nui-primary, #3b82f6);
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-checkbox__thumb {
    display: block;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .nui-checkbox__track.checked .nui-checkbox__thumb {
    transform: translateX(1rem);
  }

  .nui-checkbox__track.indeterminate .nui-checkbox__thumb {
    transform: translateX(0.5rem);
  }

  .nui-checkbox__text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    line-height: 1.3;
  }

  .nui-checkbox__label {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .nui-checkbox__description {
    font-size: 0.75rem;
    color: var(--nui-fg-secondary, #a1a1aa);
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-checkbox__track,
    .nui-checkbox__thumb {
      transition: none;
    }
  }
</style>
