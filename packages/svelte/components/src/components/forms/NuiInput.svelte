<script lang="ts">
  import { onDestroy } from 'svelte';
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  type DelayUnit = 'ms' | 's' | 'm';

  /** Maximum allowed debounce delay (60 seconds). */
  const MAX_DELAY = 60_000;

  interface Props {
    eventName?: string;
    client?: SvelteNuiClient;
    value?: string;
    label?: string;
    placeholder?: string;
    type?: 'text' | 'number' | 'password' | 'email' | 'search' | 'textarea';
    disabled?: boolean;
    readonly?: boolean;
    /**
     * Native HTML `min` attribute — effective for `number`, `range`, `date`, `time`, etc.
     * Passed through as-is; no type enforcement beyond what the browser validates.
     */
    min?: number | string;
    /**
     * Native HTML `max` attribute — effective for `number`, `range`, `date`, `time`, etc.
     * Passed through as-is; no type enforcement beyond what the browser validates.
     */
    max?: number | string;
    /** Native HTML `step` attribute — effective for `number`, `range`, `date`, `time`, etc. */
    step?: number | string;
    /**
     * Native HTML `minlength` attribute — constrains text length, not numeric value.
     * Effective for `text`, `search`, `email`, `password`, `tel`, `url`, and `textarea`.
     */
    minlength?: number;
    /**
     * Native HTML `maxlength` attribute — constrains text length, not numeric value.
     * Effective for `text`, `search`, `email`, `password`, `tel`, `url`, and `textarea`.
     */
    maxlength?: number;
    /** Native HTML `pattern` attribute — only effective for input types that support it (e.g. `text`, `search`). */
    pattern?: string;
    required?: boolean;
    autofocus?: boolean;
    autocomplete?: HTMLInputElement['autocomplete'];
    name?: string;
    /**
     * Keep the field in sync with `eventName` events coming from the game.
     *
     * When enabled, incoming values are treated as authoritative state from the game
     * and will overwrite the current field value, including text being actively edited.
     * Any pending debounced `onValueChange` is cancelled to prevent stale payloads.
     */
    twoWay?: boolean;
    /** Event sent when the value settles (immediately, or after {@link debounce}). */
    onValueChange?: string;
    onInput?: string;
    onBlur?: string;
    onFocus?: string;
    /**
     * Debounce delay for {@link onValueChange}, e.g. `'300ms'`, `'2s'`, `'1m'`.
     * Clamped to a maximum of 60 seconds. Invalid formats result in no delay.
     */
    debounce?: string;
    /** Transform applied to every incoming value when {@link twoWay} is set. */
    valueProcessor?: ((value: unknown) => string) | null;
  }

  let {
    eventName = '',
    client = nui,
    value = $bindable(''),
    label = '',
    placeholder = '',
    type = 'text',
    disabled = false,
    readonly = false,
    min = '',
    max = '',
    step = '',
    minlength = undefined,
    maxlength = undefined,
    pattern = '',
    required = false,
    autofocus = false,
    autocomplete = 'off',
    name = '',
    twoWay = false,
    onValueChange = '',
    onInput = '',
    onBlur = '',
    onFocus = '',
    debounce = '',
    valueProcessor = null
  }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Parses a human-readable delay specification into milliseconds.
   * Returns 0 for invalid formats. Result is clamped to {@link MAX_DELAY}.
   */
  function parseDelay(spec: string): number {
    const match = /^(\d+)(ms|s|m)$/.exec(spec.trim());
    if (!match) return 0;
    const amount = Number.parseInt(match[1], 10);
    if (!Number.isSafeInteger(amount)) return 0;
    const unit = match[2] as DelayUnit;
    const delay = unit === 'ms' ? amount : unit === 's' ? amount * 1000 : amount * 60_000;
    return Math.min(delay, MAX_DELAY);
  }

  /**
   * Safely sends an event via the NUI client, catching synchronous exceptions
   * and attaching a rejection handler to any returned Promise.
   */
  function safeSend(event: string, data: unknown) {
    if (!event) return;
    try {
      const res = client.send(event, data) as unknown;
      if (res && typeof (res as Promise<unknown>).catch === 'function') {
        (res as Promise<unknown>).catch((err: unknown) => {
          console.error(
            `[fivem-nui-components] NuiInput: Async error sending event '${event}':`,
            err,
          );
        });
      }
    } catch (err) {
      console.error(
        `[fivem-nui-components] NuiInput: Failed to send event '${event}':`,
        err,
      );
    }
  }

  /** Cancels any pending debounce timer. */
  function cancelDebounce() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  /**
   * Immediately flushes the current value through {@link onValueChange},
   * cancelling any pending debounce timer first.
   */
  function flushValueChange() {
    cancelDebounce();
    if (onValueChange) safeSend(onValueChange, { value });
  }

  // Two-way sync: incoming game values cancel pending debounce and override local state
  $effect(() => {
    if (!twoWay || !eventName) return;
    return client.on(eventName, (data) => {
      if (data === null || data === undefined) return;

      let processed: string;
      try {
        processed = valueProcessor ? valueProcessor(data) : String(data);
      } catch (err) {
        console.error(
          '[fivem-nui-components] NuiInput: Exception in valueProcessor:',
          err,
        );
        return;
      }

      // Cancel any pending debounce to prevent stale local value from being sent
      cancelDebounce();
      value = processed;
    });
  });

  function handleInput(event: Event) {
    const next = (event.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
    value = next;

    if (onInput) safeSend(onInput, { value: next });
    if (!onValueChange) return;

    cancelDebounce();
    const delay = parseDelay(debounce);
    if (delay > 0) {
      timer = setTimeout(() => {
        timer = null;
        safeSend(onValueChange, { value: next });
      }, delay);
    } else {
      safeSend(onValueChange, { value: next });
    }
  }

  function handleBlur() {
    // Flush any pending debounced value change with the current (latest) value
    if (timer !== null) {
      flushValueChange();
    }
    if (onBlur) safeSend(onBlur, { value });
  }

  function handleFocus() {
    if (onFocus) safeSend(onFocus, { value });
  }

  onDestroy(() => {
    cancelDebounce();
  });
</script>

<label class="nui-field">
  {#if label}<span class="nui-field__label">{label}</span>{/if}

  {#if type === 'textarea'}
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      class="nui-field__control"
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {minlength}
      {maxlength}
      {autofocus}
      {autocomplete}
      {name}
      bind:value
      oninput={handleInput}
      onblur={handleBlur}
      onfocus={handleFocus}
    ></textarea>
  {:else}
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="nui-field__control"
      {type}
      {placeholder}
      {disabled}
      {readonly}
      {required}
      {min}
      {max}
      {step}
      {minlength}
      {maxlength}
      {pattern}
      {autofocus}
      {autocomplete}
      {name}
      bind:value
      oninput={handleInput}
      onblur={handleBlur}
      onfocus={handleFocus}
    />
  {/if}
</label>

<style>
  .nui-field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    width: 100%;
  }

  .nui-field__label {
    font-size: 0.8125rem;
    font-weight: 600;
    opacity: 0.75;
  }

  .nui-field__control {
    width: 100%;
    box-sizing: border-box;
    font-family: inherit;
    font-size: 0.9375rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    background: var(--nui-surface-alt, #101012);
    color: var(--nui-fg, #fafafa);
    transition: border-color 0.15s ease;
  }

  .nui-field__control:focus {
    outline: none;
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-field__control:disabled { opacity: 0.5; cursor: not-allowed; }

  textarea.nui-field__control { min-height: 5rem; resize: vertical; }
</style>