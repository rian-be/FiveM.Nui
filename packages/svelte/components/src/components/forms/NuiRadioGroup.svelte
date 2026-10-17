<script module lang="ts">
  export interface NuiRadioOption {
    /**
     * Unique value identifying this option.
     * Must be unique within the options array to prevent key conflicts in Svelte's
     * `{#each}` block and ambiguous selection behavior.
     */
    value: string;
    /** text label for the radio option. */
    label: string;
    /** Optional secondary description text displayed below the label. */
    description?: string;
    /** Whether this individual option is disabled. */
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { nui } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";

  interface Props {
    /** NUI event name emitted when an option is selected. */
    eventName?: string;
    /** SvelteNuiClient instance used to dispatch NUI events. */
    client?: SvelteNuiClient;
    /** Currently selected value. Supports two-way binding via `bind:value`. */
    value?: string;
    /** Text rendered inside the `<legend>` element. */
    label?: string;
    /**
     * Available radio options.
     *
     * Each option's `value` must be unique within the array —
     * duplicate values will cause key conflicts in Svelte's `{#each}` block and
     * ambiguous selection behavior.
     */
    options?: NuiRadioOption[];
    /** Whether the entire radio group is disabled. */
    disabled?: boolean;
    /**
     * HTML `name` attribute for the radio group.
     *
     * If omitted or an empty string, a unique name is generated per component instance
     * via `$props.id()` to prevent cross-group interference when multiple NuiRadioGroup
     * components coexist on the same page. If a non-empty name is explicitly provided,
     * it takes precedence.
     */
    name?: string;
  }

  const autoId = $props.id();

  let {
    eventName = "",
    client = nui,
    value = $bindable(""),
    label = "",
    options = [],
    disabled = false,
    name,
  }: Props = $props();

  const groupName = $derived(name || `nui-radio-${autoId}`);

  // Warn about duplicate option values to prevent key conflicts in {#each} and ambiguous selection
  $effect(() => {
    const seen = new Set<string>();
    for (const opt of options) {
      if (seen.has(opt.value)) {
        console.warn(
          `[fivem-nui-components] NuiRadioGroup: Duplicate option value '${opt.value}' detected. Option values must be unique within the group.`,
        );
        break;
      }
      seen.add(opt.value);
    }
  });

  /**
   * Safely sends an event via the NUI client, catching synchronous exceptions.
   *
   * Note: Selection is optimistic the bound `value` is updated immediately and
   * does not revert if network transport fails.
   */
  function safeSend(event: string, data: unknown) {
    if (!event) return;
    try {
      client.send(event, data);
    } catch (err) {
      console.error(
        `[fivem-nui-components] NuiRadioGroup: Failed to send event '${event}':`,
        err,
      );
    }
  }

  function select(option: NuiRadioOption) {
    if (disabled || option.disabled) return;
    value = option.value;
    safeSend(eventName, { value: option.value, label: option.label });
  }
</script>

<fieldset class="nui-radiogroup" {disabled}>
  {#if label}<legend class="nui-radiogroup__label">{label}</legend>{/if}

  {#each options as option, i (`${option.value}-${i}`)}
    <label
      class="nui-radio-option"
      class:is-disabled={option.disabled || disabled}
      class:is-checked={value === option.value}
    >
      <input
        class="nui-radio-option__input"
        type="radio"
        name={groupName}
        value={option.value}
        checked={value === option.value}
        disabled={option.disabled || disabled}
        onchange={() => select(option)}
      />
      <span class="nui-radio-track" aria-hidden="true"
        ><span class="nui-radio-dot"></span></span
      >
      <span class="nui-radio-text">
        <span class="nui-radio-label">{option.label}</span>
        {#if option.description}
          <span class="nui-radio-description">{option.description}</span>
        {/if}
      </span>
    </label>
  {/each}
</fieldset>

<style>
  .nui-radiogroup {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    border: 0;
    font-family: inherit;
  }

  .nui-radiogroup__label {
    padding: 0 0 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    opacity: 0.75;
    color: var(--nui-fg, #fafafa);
  }

  .nui-radio-option {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4rem 0.5rem;
    border-radius: var(--nui-radius, 0.375rem);
    cursor: pointer;
    color: var(--nui-fg, #fafafa);
    transition: background 0.15s ease;
    user-select: none;
  }

  .nui-radio-option:hover:not(.is-disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.05));
  }

  .nui-radio-option.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* Visually hidden using standard technique — accessible to screen readers & keyboard */
  .nui-radio-option__input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    clip-path: inset(50%);
    border: 0;
    white-space: nowrap;
  }

  /* Visible focus indicator on the custom radio track when navigating via keyboard */
  .nui-radio-option__input:focus-visible + .nui-radio-track {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 3px;
  }

  .nui-radio-track {
    position: relative;
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    border: 2px solid var(--nui-border, #52525b);
    border-radius: 50%;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
  }

  .nui-radio-option.is-checked .nui-radio-track {
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-radio-dot {
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    background: var(--nui-primary, #3b82f6);
    transform: scale(0);
    transition: transform 0.15s ease;
  }

  .nui-radio-option.is-checked .nui-radio-dot {
    transform: scale(1);
  }

  .nui-radio-text {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .nui-radio-label {
    font-size: 0.875rem;
  }

  .nui-radio-description {
    font-size: 0.75rem;
    opacity: 0.65;
  }
</style>
