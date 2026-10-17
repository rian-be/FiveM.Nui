<script module lang="ts">
  export interface NuiSelectOption {
    /** Unique value identifying this option. */
    value: string;
    /** Human-readable text label. */
    label: string;
    /** Whether this individual option is disabled. */
    disabled?: boolean;
  }
</script>

<script lang="ts">
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  interface Props {
    /** NUI event name emitted when selection changes or is cleared. */
    eventName?: string;
    /** SvelteNuiClient instance used to dispatch NUI events. */
    client?: SvelteNuiClient;
    /**
     * Current selection value (two-way bindable):
     * - In single-select mode (`multiple={false}`): a plain string containing the selected option's `value` (e.g. `'item_1'`), or `''` if empty.
     * - In multi-select mode (`multiple={true}`): a serialized JSON array string of selected option values (e.g. `'["item_1", "item_2"]'`), or `'[]'` / `''` if empty.
     *
     * Note: In multi-select mode, the underlying `<input type="hidden" {name} {value} />` submits this JSON string.
     * When emitting the NUI event (`eventName`), a parsed array (`value: string[]`) is provided in the event payload.
     */
    value?: string;
    /** Text label displayed above the select control. */
    label?: string;
    /** Placeholder text shown when no option is selected. Defaults to 'Select...'. */
    placeholder?: string;
    /** Available select options. Each option's `value` must be unique. */
    options?: NuiSelectOption[];
    /** Whether the select control is disabled. */
    disabled?: boolean;
    /**
     * Whether multiple options can be selected simultaneously.
     * When enabled, `value` binds to a serialized JSON array of selected strings (e.g. `'["opt1","opt2"]'`).
     */
    multiple?: boolean;
    /** Whether the search input is enabled in the dropdown panel. Defaults to true. */
    searchable?: boolean;
    /** Maximum CSS height for the dropdown panel (e.g. '200px', '15rem'). Defaults to '200px'. */
    maxHeight?: string;
    /**
     * Form input name attribute rendered on an underlying `<input type="hidden" {name} {value} />`.
     * In single mode, submits the selected string value. In multi-select mode, submits the JSON array string.
     */
    name?: string;
  }

  const autoId = $props.id();
  const selectId = `nui-select-${autoId}`;
  const labelId = `${selectId}-label`;
  const triggerId = `${selectId}-trigger`;
  const listboxId = `${selectId}-listbox`;
  const valueId = `${selectId}-val`;

  let {
    eventName = '',
    client = nui,
    value = $bindable(''),
    label = '',
    placeholder = 'Select...',
    options = [],
    disabled = false,
    multiple = false,
    searchable = true,
    maxHeight = '200px',
    name = ''
  }: Props = $props();

  let open = $state(false);
  let query = $state('');
  let focusedIndex = $state(-1);
  let containerEl: HTMLElement | null = $state(null);
  let triggerButtonEl: HTMLButtonElement | null = $state(null);
  let searchInputEl: HTMLInputElement | null = $state(null);
  let listboxEl: HTMLElement | null = $state(null);

  let previousOptions: NuiSelectOption[] | undefined;
  let lastFocusedValue: string | undefined;

  /**
   * Safely normalizes the bound `value` string into a typed `string[]` for multiple selection.
   * Handles valid JSON arrays, non-array JSON values, and malformed strings gracefully.
   */
  const selected = $derived.by((): string[] => {
    if (!multiple || !value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [value];
    } catch {
      return [value];
    }
  });

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  const triggerLabel = $derived.by(() => {
    if (multiple) {
      return selected.length ? selected.map(labelOf).join(', ') : placeholder;
    }
    return value ? labelOf(value) : placeholder;
  });

  const visible = $derived.by(() => {
    const term = query.trim().toLowerCase();
    return term
      ? options.filter((o) => o.label.toLowerCase().includes(term) && !o.disabled)
      : options;
  });

  const canClear = $derived(!disabled && (multiple ? selected.length > 0 : value !== ''));

  /**
   * Computes the ID of the currently focused option for `aria-activedescendant`.
   * Only returns an ID when focusedIndex points to an existing, non-disabled option.
   */
  const activeDescendantId = $derived(
    open && focusedIndex >= 0 && visible[focusedIndex] && !visible[focusedIndex].disabled
      ? `${listboxId}-opt-${focusedIndex}`
      : undefined
  );

  // Warn about duplicate option values to prevent key conflicts in {#each} and ambiguous selection
  $effect(() => {
    const seen = new Set<string>();
    for (const opt of options) {
      if (seen.has(opt.value)) {
        console.warn(
          `[fivem-nui-components] NuiSelect: Duplicate option value '${opt.value}' detected. Option values must be unique.`,
        );
        break;
      }
      seen.add(opt.value);
    }
  });

  // Close dropdown and reset state when disabled state changes to true
  $effect(() => {
    if (disabled && open) {
      open = false;
      query = '';
      focusedIndex = -1;
      lastFocusedValue = undefined;
    }
  });

  // Focus appropriate element when dropdown opens
  $effect(() => {
    if (open) {
      if (searchable && searchInputEl) {
        searchInputEl.focus();
      } else if (!searchable && listboxEl) {
        listboxEl.focus();
      }
    }
  });

  // Preserve active option when options array reference changes from parent while open
  $effect(() => {
    const currentOptions = options;
    if (previousOptions !== undefined && currentOptions !== previousOptions) {
      if (open) {
        if (lastFocusedValue !== undefined) {
          const newIdx = visible.findIndex((o) => o.value === lastFocusedValue && !o.disabled);
          if (newIdx >= 0) {
            focusedIndex = newIdx;
            lastFocusedValue = visible[newIdx]?.value;
            previousOptions = currentOptions;
            return;
          }
        }
        focusFirst();
      }
    }
    previousOptions = currentOptions;
  });

  // Scroll focused option into view when navigating via keyboard
  $effect(() => {
    if (open && focusedIndex >= 0 && listboxEl) {
      const optEl = listboxEl.querySelector(`[data-index="${focusedIndex}"]`);
      if (optEl && typeof (optEl as HTMLElement).scrollIntoView === 'function') {
        (optEl as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  });

  /**
   * Safely sends an event via the NUI client, catching synchronous exceptions
   * and handling any returned Promise rejection asynchronously.
   */
  function safeSend(event: string, data: unknown) {
    if (!event) return;
    try {
      const res = client.send(event, data);
      void Promise.resolve(res).catch((err: unknown) => {
        console.error(
          `[fivem-nui-components] NuiSelect: Async error sending event '${event}':`,
          err,
        );
      });
    } catch (err) {
      console.error(
        `[fivem-nui-components] NuiSelect: Failed to send event '${event}':`,
        err,
      );
    }
  }

  function focusFirst() {
    const idx = visible.findIndex((o) => !o.disabled);
    focusedIndex = idx;
    lastFocusedValue = idx >= 0 ? visible[idx]?.value : undefined;
  }

  function focusLast() {
    for (let i = visible.length - 1; i >= 0; i--) {
      if (!visible[i].disabled) {
        focusedIndex = i;
        lastFocusedValue = visible[i]?.value;
        return;
      }
    }
    focusedIndex = -1;
    lastFocusedValue = undefined;
  }

  /**
   * Finds the next enabled option index starting from current focusedIndex in direction `delta` (1 or -1).
   * Guarantees that the resulting focusedIndex is either a valid enabled option or -1 (if none enabled).
   */
  function moveFocus(delta: number) {
    const total = visible.length;
    if (total === 0 || !visible.some((o) => !o.disabled)) {
      focusedIndex = -1;
      lastFocusedValue = undefined;
      return;
    }

    let next = focusedIndex;
    if (next < 0 || next >= total) {
      next = delta > 0 ? -1 : total;
    }

    for (let step = 0; step < total; step++) {
      next = (next + delta + total) % total;
      if (!visible[next].disabled) {
        focusedIndex = next;
        lastFocusedValue = visible[next]?.value;
        return;
      }
    }
    focusedIndex = -1;
    lastFocusedValue = undefined;
  }

  function selectFocusedOption(): boolean {
    if (focusedIndex >= 0 && focusedIndex < visible.length) {
      const option = visible[focusedIndex];
      if (option && !option.disabled) {
        selectOption(option);
        return true;
      }
    }
    return false;
  }

  function openDropdown() {
    if (disabled) return;
    open = true;

    // Pre-focus the currently selected option if visible and enabled
    if (!multiple && value) {
      const selectedIdx = visible.findIndex((o) => o.value === value && !o.disabled);
      if (selectedIdx >= 0) {
        focusedIndex = selectedIdx;
        lastFocusedValue = visible[selectedIdx]?.value;
      } else {
        focusFirst();
      }
    } else {
      focusFirst();
    }
  }

  function closeDropdown(restoreFocus = true) {
    open = false;
    query = '';
    focusedIndex = -1;
    lastFocusedValue = undefined;
    if (restoreFocus && triggerButtonEl) {
      triggerButtonEl.focus();
    }
  }

  function toggle() {
    if (disabled) return;
    if (open) {
      closeDropdown(false);
    } else {
      openDropdown();
    }
  }

  function selectOption(option: NuiSelectOption) {
    if (disabled || option.disabled) return;

    if (multiple) {
      const next = selected.includes(option.value)
        ? selected.filter((v) => v !== option.value)
        : [...selected, option.value];
      value = JSON.stringify(next);
      safeSend(eventName, {
        value: next,
        option: { value: option.value, label: option.label },
        multiple: true
      });
    } else {
      value = option.value;
      closeDropdown(true);
      safeSend(eventName, {
        value: option.value,
        label: option.label,
        multiple: false
      });
    }
  }

  function clear(event: MouseEvent) {
    event.stopPropagation();
    if (disabled) return;

    if (multiple) {
      value = '[]';
      safeSend(eventName, { value: [], multiple: true });
    } else {
      value = '';
      safeSend(eventName, { value: '', label: '', multiple: false });
    }

    if (triggerButtonEl) {
      triggerButtonEl.focus();
    }
  }

  function handleSearchInput(event: Event) {
    query = (event.currentTarget as HTMLInputElement).value;
    focusFirst();
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        openDropdown();
      } else {
        moveFocus(1);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openDropdown();
      } else {
        moveFocus(-1);
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openDropdown();
      } else {
        selectFocusedOption();
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeDropdown(true);
      }
    } else if (event.key === 'Tab') {
      if (open) {
        closeDropdown(false);
      }
    }
  }

  function onSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusFirst();
    } else if (event.key === 'End') {
      event.preventDefault();
      focusLast();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      selectFocusedOption();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDropdown(true);
    } else if (event.key === 'Tab') {
      closeDropdown(false);
    }
  }

  function onListboxKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusFirst();
    } else if (event.key === 'End') {
      event.preventDefault();
      focusLast();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectFocusedOption();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDropdown(true);
    } else if (event.key === 'Tab') {
      closeDropdown(false);
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (open && containerEl && !containerEl.contains(event.target as Node)) {
      closeDropdown(false);
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div
  class="nui-select"
  class:is-open={open}
  class:is-disabled={disabled}
  class:has-clear={canClear}
  bind:this={containerEl}
>
  {#if label}
    <span id={labelId} class="nui-select__label">{label}</span>
  {/if}

  <div class="nui-select__control">
    <button
      type="button"
      id={triggerId}
      class="nui-select__trigger"
      bind:this={triggerButtonEl}
      disabled={disabled}
      role={!searchable ? 'combobox' : undefined}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={listboxId}
      aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
      onclick={toggle}
      onkeydown={onTriggerKeydown}
    >
      <span
        id={valueId}
        class="nui-select__value"
        class:is-placeholder={!value || (multiple && !selected.length)}
      >
        {triggerLabel}
      </span>
      <span class="nui-select__arrow" aria-hidden="true">{open ? '▴' : '▾'}</span>
    </button>

    {#if canClear}
      <button
        type="button"
        class="nui-select__clear"
        aria-label="Clear selection"
        onclick={clear}
      >×</button>
    {/if}
  </div>

  {#if open}
    <div class="nui-select__panel" style:max-height={maxHeight}>
      {#if searchable}
        <input
          bind:this={searchInputEl}
          class="nui-select__search"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          placeholder="Search..."
          value={query}
          aria-label={label ? `Search ${label}` : 'Search options'}
          onclick={(e) => e.stopPropagation()}
          oninput={handleSearchInput}
          onkeydown={onSearchKeydown}
        />
      {/if}
      <ul
        id={listboxId}
        class="nui-select__options"
        role="listbox"
        aria-multiselectable={multiple ? 'true' : undefined}
        aria-labelledby={label ? labelId : triggerId}
        aria-activedescendant={!searchable ? activeDescendantId : undefined}
        bind:this={listboxEl}
        tabindex={!searchable ? 0 : -1}
        onkeydown={!searchable ? onListboxKeydown : undefined}
      >
        {#each visible as option, idx (option.value)}
          {@const isSelected = multiple ? selected.includes(option.value) : value === option.value}
          {@const isFocused = focusedIndex === idx}
          <li
            id={`${listboxId}-opt-${idx}`}
            role="option"
            class="nui-select__option"
            class:is-selected={isSelected}
            class:is-focused={isFocused}
            class:is-disabled={option.disabled}
            aria-selected={isSelected}
            aria-disabled={option.disabled ? 'true' : undefined}
            data-index={idx}
            onclick={() => selectOption(option)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectOption(option);
              }
            }}
            onmouseenter={() => {
              if (!option.disabled) {
                focusedIndex = idx;
                lastFocusedValue = option.value;
              }
            }}
          >
            <span class="nui-select__option-text">{option.label}</span>
            {#if multiple && isSelected}
              <span class="nui-select__check" aria-hidden="true">✓</span>
            {/if}
          </li>
        {:else}
          <li class="nui-select__empty" role="presentation">No results found</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if name}
    <!-- Form integration: submits value string (plain string in single mode, serialized JSON array in multiple mode) -->
    <input type="hidden" {name} {value} />
  {/if}
</div>

<style>
  .nui-select {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-family: inherit;
  }

  .nui-select__label {
    font-size: 0.8125rem;
    font-weight: 600;
    opacity: 0.75;
    color: var(--nui-fg, #fafafa);
  }

  .nui-select__control {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .nui-select__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    background: var(--nui-surface-alt, #101012);
    color: var(--nui-fg, #fafafa);
    font: inherit;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.15s ease, outline 0.15s ease;
    text-align: left;
  }

  .nui-select.has-clear .nui-select__trigger {
    padding-right: 2.25rem;
  }

  .nui-select__trigger:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-select__trigger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nui-select.is-open .nui-select__trigger {
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-select__value {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nui-select__value.is-placeholder {
    opacity: 0.55;
  }

  .nui-select__clear {
    position: absolute;
    right: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 0.2rem;
    background: transparent;
    color: inherit;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.6;
    padding: 0.2rem 0.35rem;
    transition: opacity 0.15s ease, background 0.15s ease;
  }

  .nui-select__clear:hover {
    opacity: 1;
    background: var(--nui-hover, rgb(255 255 255 / 0.1));
  }

  .nui-select__clear:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 1px;
    opacity: 1;
  }

  .nui-select__arrow {
    flex: none;
    font-size: 0.75rem;
    opacity: 0.7;
    pointer-events: none;
  }

  .nui-select__panel {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    right: 0;
    z-index: var(--nui-z-dropdown, 100);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    background: var(--nui-surface, #18181b);
    box-shadow: 0 15px 35px rgb(0 0 0 / 0.4);
  }

  .nui-select__search {
    margin: 0.375rem;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: 0.25rem;
    background: var(--nui-surface-alt, #101012);
    color: inherit;
    font: inherit;
    box-sizing: border-box;
  }

  .nui-select__search:focus {
    outline: 1px solid var(--nui-primary, #3b82f6);
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-select__options {
    list-style: none;
    margin: 0;
    padding: 0.25rem;
    overflow-y: auto;
    outline: none;
  }

  .nui-select__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.45rem 0.6rem;
    border-radius: 0.25rem;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
    user-select: none;
    transition: background 0.1s ease;
  }

  .nui-select__option:hover:not(.is-disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
  }

  .nui-select__option.is-focused:not(.is-disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.1));
  }

  .nui-select__option.is-selected {
    background: var(--nui-primary, #3b82f6);
    color: #fff;
  }

  .nui-select__option.is-selected.is-focused {
    filter: brightness(1.1);
  }

  .nui-select__option.is-disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-select__option-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nui-select__check {
    margin-left: 0.5rem;
    font-weight: bold;
    font-size: 0.85rem;
  }

  .nui-select__empty {
    padding: 0.6rem;
    opacity: 0.55;
    text-align: center;
    font-size: 0.875rem;
  }
</style>
