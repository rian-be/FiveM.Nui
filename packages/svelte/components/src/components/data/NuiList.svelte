<!--
  @component NuiList
  Interactive list component supporting actions, icons, descriptions, and toggle switches.

  Controlled Component:
  Switch items follow a controlled state pattern where `switchValue` reflects the authoritative state
  from backend/parent data. Toggling emits `switchEvent` and `onSwitchToggle` to request a state change.
-->
<script module lang="ts">
  /**
   * Represents an item in the {@link NuiList} component.
   */
  export interface NuiListItem {
    /** Unique item identifier. Highly recommended for dynamic or reorderable lists. */
    id?: string;
    /** Primary display label. */
    label: string;
    /** Associated value (should be JSON-serializable if transmitted via NUI). */
    value?: unknown;
    /** Icon string, emoji, or icon character. */
    icon?: string;
    /** Secondary description text. */
    description?: string;
    /** Whether to render a toggle switch instead of an action button. */
    switch?: boolean;
    /** Current state of the toggle switch. */
    switchValue?: boolean;
    /** NUI event sent to game client when switch state is toggled. */
    switchEvent?: string;
    /** Item-specific NUI event sent on item click. */
    eventName?: string;
    /** Whether the item is disabled. */
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  type MaybePromise<T> = T | Promise<T>;

  interface Props {
    /** Array of list items to display. */
    items?: NuiListItem[];
    /** SvelteNuiClient instance for event transport. */
    client?: SvelteNuiClient;
    /** Vertical density sizing. */
    itemSize?: 'sm' | 'md' | 'lg';
    /** Global NUI event name sent with `{ id, value }` when any row is activated. */
    selectEvent?: string;
    /** Local click callback executed when an item is activated (supports sync or async). */
    onItemClick?: (item: NuiListItem) => MaybePromise<void>;
    /** Local change callback executed when a switch item is toggled (supports sync or async). */
    onSwitchToggle?: (item: NuiListItem, value: boolean) => MaybePromise<void>;
  }

  let {
    items = [],
    client = nui,
    itemSize = 'md',
    selectEvent = '',
    onItemClick,
    onSwitchToggle
  }: Props = $props();

  function safeCall(fn: (() => unknown) | undefined, errorPrefix: string): void {
    if (!fn) return;
    try {
      const result = fn();
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch((err) => {
          console.error(errorPrefix, err);
        });
      }
    } catch (err) {
      console.error(errorPrefix, err);
    }
  }

  function handleItemClick(item: NuiListItem) {
    if (item.disabled) return;
    if (item.eventName) {
      try {
        client.send(item.eventName, { value: item.value, id: item.id });
      } catch (err) {
        console.error(`[fivem-nui-components] Failed to send event '${item.eventName}':`, err);
      }
    }
    if (selectEvent) {
      try {
        client.send(selectEvent, { id: item.id, value: item.value });
      } catch (err) {
        console.error(`[fivem-nui-components] Failed to send selectEvent '${selectEvent}':`, err);
      }
    }
    safeCall(
      () => onItemClick?.(item),
      '[fivem-nui-components] onItemClick callback error:'
    );
  }

  function handleSwitch(item: NuiListItem) {
    if (item.disabled) return;
    const nextVal = !(item.switchValue ?? false);
    if (item.switchEvent) {
      try {
        client.send(item.switchEvent, { id: item.id, value: nextVal });
      } catch (err) {
        console.error(`[fivem-nui-components] Failed to send switchEvent '${item.switchEvent}':`, err);
      }
    }
    safeCall(
      () => onSwitchToggle?.(item, nextVal),
      '[fivem-nui-components] onSwitchToggle callback error:'
    );
  }
</script>

<ul class="nui-list nui-list--{itemSize}">
  {#each items as item, index (item.id ?? `${item.label}-${index}`)}
    <li class="nui-list-item" class:nui-list-item--switch={item.switch}>
      {#if item.switch}
        <label class="nui-list-item-label" class:disabled={item.disabled}>
          {#if item.icon}
            <span class="nui-list-item-icon" aria-hidden="true">{item.icon}</span>
          {/if}
          <span class="nui-list-item-text">
            <span class="nui-list-item-title">{item.label}</span>
            {#if item.description}
              <span class="nui-list-item-description">{item.description}</span>
            {/if}
          </span>
          <span class="nui-switch-wrapper">
            <input
              type="checkbox"
              class="nui-switch__input"
              checked={item.switchValue ?? false}
              disabled={item.disabled}
              onchange={() => handleSwitch(item)}
            />
            <span class="nui-switch" class:checked={item.switchValue ?? false} aria-hidden="true">
              <span class="nui-switch__thumb"></span>
            </span>
          </span>
        </label>
      {:else}
        <button
          type="button"
          class="nui-list-item-btn"
          disabled={item.disabled}
          onclick={() => handleItemClick(item)}
        >
          {#if item.icon}
            <span class="nui-list-item-icon" aria-hidden="true">{item.icon}</span>
          {/if}
          <span class="nui-list-item-text">
            <span class="nui-list-item-title">{item.label}</span>
            {#if item.description}
              <span class="nui-list-item-description">{item.description}</span>
            {/if}
          </span>
        </button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .nui-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    font-family: inherit;
    width: 100%;
  }

  .nui-list-item {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--nui-border, #27272a);
  }

  .nui-list-item:last-child {
    border-bottom: none;
  }

  .nui-list-item-btn,
  .nui-list-item-label {
    box-sizing: border-box;
  }

  .nui-list--sm .nui-list-item-btn,
  .nui-list--sm .nui-list-item-label {
    padding: 0.4rem 0.625rem;
  }
  .nui-list--md .nui-list-item-btn,
  .nui-list--md .nui-list-item-label {
    padding: 0.6rem 0.875rem;
  }
  .nui-list--lg .nui-list-item-btn,
  .nui-list--lg .nui-list-item-label {
    padding: 0.85rem 1.125rem;
  }

  .nui-list-item-btn {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    cursor: pointer;
    border-radius: var(--nui-radius, 0.375rem);
    transition: background 0.15s ease;
  }

  .nui-list-item-btn:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.04));
  }

  .nui-list-item-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .nui-list-item-btn:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-list-item-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    font-size: 0.875rem;
    cursor: pointer;
    border-radius: var(--nui-radius, 0.375rem);
    transition: background 0.15s ease;
  }

  .nui-list-item-label:hover:not(.disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.04));
  }

  .nui-list-item-label.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .nui-list-item-icon {
    font-size: 1.15rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .nui-list-item-text {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
    flex: 1;
    min-width: 0;
  }

  .nui-list-item-title {
    font-weight: 500;
    font-size: 0.875rem;
    color: var(--nui-fg, #fafafa);
    overflow-wrap: anywhere;
  }

  .nui-list-item-description {
    font-size: 0.75rem;
    opacity: 0.65;
    overflow-wrap: anywhere;
  }

  .nui-switch-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .nui-switch__input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
    margin: 0;
    pointer-events: none;
  }

  .nui-switch {
    flex: none;
    width: 2.25rem;
    height: 1.25rem;
    padding: 0.125rem;
    border-radius: 999px;
    background: var(--nui-surface-alt, #3f3f46);
    border: 1px solid var(--nui-border, #52525b);
    transition: background 0.2s ease, border-color 0.2s ease;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
  }

  .nui-switch.checked {
    background: var(--nui-primary, #3b82f6);
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-switch__input:focus-visible + .nui-switch {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 3px;
  }

  .nui-switch__thumb {
    display: block;
    width: 0.95rem;
    height: 0.95rem;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s ease;
  }

  .nui-switch.checked .nui-switch__thumb {
    transform: translateX(1rem);
  }
</style>
