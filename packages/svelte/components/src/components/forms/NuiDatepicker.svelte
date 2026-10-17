<!--
  @component NuiDatepicker
  Accessible date picker component conforming to WAI-ARIA grid design pattern,
  supporting full keyboard navigation (arrows, PageUp/PageDown, Home/End, Escape),
  strict ISO date validation, min/max constraints, today highlighting, and FiveM NUI event integration.
-->
<script lang="ts">
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  interface Props {
    /** Optional HTML id attribute. Auto-generated via $props.id() if omitted. */
    id?: string;
    /** Selected date string in YYYY-MM-DD format. Supports two-way binding. */
    value?: string;
    /** Visual label text displayed above the control. */
    label?: string;
    /** Placeholder text displayed when no date is selected. */
    placeholder?: string;
    /** Whether the datepicker is disabled. */
    disabled?: boolean;
    /** Minimum allowed date in YYYY-MM-DD format. */
    min?: string;
    /** Maximum allowed date in YYYY-MM-DD format. */
    max?: string;
    /** Accessible label for screen readers when visual label is omitted. */
    ariaLabel?: string;
    /** Optional NUI event name sent on date selection with `{ value: dateStr }`. */
    eventName?: string;
    /** Callback fired when a valid date is selected. */
    onSelect?: (date: string) => void;
    /** SvelteNuiClient instance for event transport. */
    client?: SvelteNuiClient;
  }

  const autoId = $props.id();

  let {
    id,
    value = $bindable(''),
    label = '',
    placeholder = 'Select date...',
    disabled = false,
    min = '',
    max = '',
    ariaLabel,
    eventName,
    onSelect,
    client = nui
  }: Props = $props();

  let isOpen = $state(false);
  let containerEl = $state<HTMLElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let calendarEl = $state<HTMLDivElement | null>(null);

  const controlId = $derived(id || autoId);
  const labelId = $derived(label ? `${controlId}-label` : undefined);
  const calendarId = $derived(`${controlId}-calendar`);
  const resolvedAriaLabel = $derived(!label ? (ariaLabel || 'Select date') : undefined);

  /** Validates whether a string is a genuine, calendar-valid YYYY-MM-DD date. */
  function isValidDateString(dateStr: string | undefined): dateStr is string {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y < 1000 || y > 9999 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  }

  function parseDateString(dateStr: string): Date | null {
    if (!isValidDateString(dateStr)) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const today = new Date();
  const todayStr = formatDateString(today);

  const validMin = $derived(isValidDateString(min) ? min : undefined);
  const validMax = $derived(isValidDateString(max) ? max : undefined);

  // Validate range order and warn if min > max
  const effectiveMin = $derived(validMin);
  const effectiveMax = $derived.by(() => {
    if (validMin && validMax && validMin > validMax) {
      console.warn(
        `[fivem-nui-components] NuiDatepicker: min (${validMin}) is greater than max (${validMax}). Disregarding max constraint.`
      );
      return undefined;
    }
    return validMax;
  });

  const validValue = $derived(isValidDateString(value) ? value : '');
  const isValueMalformed = $derived(Boolean(value && !isValidDateString(value)));
  const isValueOutOfRange = $derived.by(() => {
    if (!validValue) return false;
    if (effectiveMin && validValue < effectiveMin) return true;
    if (effectiveMax && validValue > effectiveMax) return true;
    return false;
  });
  const isValueInvalid = $derived(isValueMalformed || isValueOutOfRange);

  // Development warnings for invalid props
  $effect(() => {
    if (value && !isValidDateString(value)) {
      console.warn(
        `[fivem-nui-components] NuiDatepicker: value '${value}' is not a valid ISO-8601 date (YYYY-MM-DD).`
      );
    } else if (validValue && isValueOutOfRange) {
      console.warn(
        `[fivem-nui-components] NuiDatepicker: value '${validValue}' is outside allowed range [${effectiveMin ?? '-inf'}, ${effectiveMax ?? '+inf'}].`
      );
    }
  });

  $effect(() => {
    if (min && !isValidDateString(min)) {
      console.warn(
        `[fivem-nui-components] NuiDatepicker: min prop '${min}' is not a valid ISO-8601 date (YYYY-MM-DD).`
      );
    }
    if (max && !isValidDateString(max)) {
      console.warn(
        `[fivem-nui-components] NuiDatepicker: max prop '${max}' is not a valid ISO-8601 date (YYYY-MM-DD).`
      );
    }
  });

  let viewYear = $state(today.getFullYear());
  let viewMonth = $state(today.getMonth());
  let focusedDateStr = $state<string>(todayStr);

  function clampToAllowedRange(dateStr: string): string {
    if (effectiveMin && dateStr < effectiveMin) return effectiveMin;
    if (effectiveMax && dateStr > effectiveMax) return effectiveMax;
    return dateStr;
  }

  // Sync calendar view with valid, in-range incoming value
  $effect(() => {
    if (validValue && !isValueOutOfRange) {
      const parts = validValue.split('-').map(Number);
      viewYear = parts[0];
      viewMonth = parts[1] - 1;
      focusedDateStr = validValue;
    }
  });

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const canPrevMonth = $derived.by(() => {
    if (!effectiveMin) return true;
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    return formatDateString(prevMonthEnd) >= effectiveMin;
  });

  const canNextMonth = $derived.by(() => {
    if (!effectiveMax) return true;
    const nextMonthStart = new Date(viewYear, viewMonth + 1, 1);
    return formatDateString(nextMonthStart) <= effectiveMax;
  });

  function prevMonth() {
    if (!canPrevMonth) return;
    viewMonth--;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear--;
    }
  }

  function nextMonth() {
    if (!canNextMonth) return;
    viewMonth++;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear++;
    }
  }

  interface CalendarCell {
    empty: boolean;
    day?: number;
    dateStr?: string;
    disabled?: boolean;
  }

  const calendarWeeks = $derived.by((): CalendarCell[][] => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    // Monday-based offset (0 = Mon, 6 = Sun)
    const offset = (firstDay + 6) % 7;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: CalendarCell[] = [];

    for (let i = 0; i < offset; i++) {
      cells.push({ empty: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      const dateStr = `${viewYear}-${mm}-${dd}`;
      const isBeforeMin = effectiveMin ? dateStr < effectiveMin : false;
      const isAfterMax = effectiveMax ? dateStr > effectiveMax : false;

      cells.push({
        empty: false,
        day: d,
        dateStr,
        disabled: isBeforeMin || isAfterMax
      });
    }

    // Pad trailing cells to complete the final 7-day row
    const remainder = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < remainder; i++) {
      cells.push({ empty: true });
    }

    const weeks: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    return weeks;
  });

  function selectDate(dateStr: string) {
    if (!isValidDateString(dateStr)) return;
    if (effectiveMin && dateStr < effectiveMin) return;
    if (effectiveMax && dateStr > effectiveMax) return;

    value = dateStr;
    closeCalendar(true);

    if (eventName) {
      try {
        client.send(eventName, { value: dateStr });
      } catch (err) {
        console.error(`[fivem-nui-components] Failed to send datepicker event '${eventName}':`, err);
      }
    }

    onSelect?.(dateStr);
  }

  function openCalendar() {
    if (disabled) return;
    isOpen = true;

    // Ensure initial focus lands strictly on an in-range, enabled day
    const candidate =
      validValue &&
      (!effectiveMin || validValue >= effectiveMin) &&
      (!effectiveMax || validValue <= effectiveMax)
        ? validValue
        : clampToAllowedRange(todayStr);

    focusedDateStr = candidate;
    const activeDate = parseDateString(candidate) || new Date();
    viewYear = activeDate.getFullYear();
    viewMonth = activeDate.getMonth();

    requestAnimationFrame(() => {
      calendarEl?.querySelector<HTMLButtonElement>(`button[data-date="${focusedDateStr}"]`)?.focus();
    });
  }

  function closeCalendar(restoreFocus = true) {
    isOpen = false;
    if (restoreFocus) {
      triggerEl?.focus();
    }
  }

  function toggleCalendar() {
    if (isOpen) {
      closeCalendar(true);
    } else {
      openCalendar();
    }
  }

  function changeFocusedDate(daysDelta: number) {
    const current = parseDateString(focusedDateStr) || new Date(viewYear, viewMonth, 1);
    const nextDate = new Date(current.getFullYear(), current.getMonth(), current.getDate() + daysDelta);
    let nextStr = formatDateString(nextDate);

    if (effectiveMin && nextStr < effectiveMin) nextStr = effectiveMin;
    if (effectiveMax && nextStr > effectiveMax) nextStr = effectiveMax;

    focusedDateStr = nextStr;
    const resolved = parseDateString(nextStr);
    if (resolved) {
      viewYear = resolved.getFullYear();
      viewMonth = resolved.getMonth();
    }

    requestAnimationFrame(() => {
      calendarEl?.querySelector<HTMLButtonElement>(`button[data-date="${nextStr}"]`)?.focus();
    });
  }

  function changeFocusedMonth(monthsDelta: number) {
    const current = parseDateString(focusedDateStr) || new Date(viewYear, viewMonth, 1);
    const nextDate = new Date(current.getFullYear(), current.getMonth() + monthsDelta, current.getDate());
    if (nextDate.getDate() !== current.getDate()) {
      nextDate.setDate(0);
    }
    let nextStr = formatDateString(nextDate);

    if (effectiveMin && nextStr < effectiveMin) nextStr = effectiveMin;
    if (effectiveMax && nextStr > effectiveMax) nextStr = effectiveMax;

    focusedDateStr = nextStr;
    const resolved = parseDateString(nextStr);
    if (resolved) {
      viewYear = resolved.getFullYear();
      viewMonth = resolved.getMonth();
    }

    requestAnimationFrame(() => {
      calendarEl?.querySelector<HTMLButtonElement>(`button[data-date="${nextStr}"]`)?.focus();
    });
  }

  function moveToWeekBoundary(boundary: 'start' | 'end') {
    const current = parseDateString(focusedDateStr) || new Date(viewYear, viewMonth, 1);
    const dayOfWeek = (current.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const delta = boundary === 'start' ? -dayOfWeek : 6 - dayOfWeek;
    const nextDate = new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta);
    let targetStr = formatDateString(nextDate);

    if (effectiveMin && targetStr < effectiveMin) targetStr = effectiveMin;
    if (effectiveMax && targetStr > effectiveMax) targetStr = effectiveMax;

    focusedDateStr = targetStr;
    const resolved = parseDateString(targetStr);
    if (resolved) {
      viewYear = resolved.getFullYear();
      viewMonth = resolved.getMonth();
    }

    requestAnimationFrame(() => {
      calendarEl?.querySelector<HTMLButtonElement>(`button[data-date="${targetStr}"]`)?.focus();
    });
  }

  /** Keyboard handler for the calendar grid days (Arrow keys, PageUp/Down, Home/End). */
  function handleGridKeyDown(event: KeyboardEvent) {
    const isDayButton = (event.target as HTMLElement)?.classList.contains('nui-datepicker__day');
    if (!isDayButton) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        changeFocusedDate(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        changeFocusedDate(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        changeFocusedDate(-7);
        break;
      case 'ArrowDown':
        event.preventDefault();
        changeFocusedDate(7);
        break;
      case 'PageUp':
        event.preventDefault();
        if (event.shiftKey) {
          changeFocusedMonth(-12);
        } else {
          changeFocusedMonth(-1);
        }
        break;
      case 'PageDown':
        event.preventDefault();
        if (event.shiftKey) {
          changeFocusedMonth(12);
        } else {
          changeFocusedMonth(1);
        }
        break;
      case 'Home':
        event.preventDefault();
        moveToWeekBoundary('start');
        break;
      case 'End':
        event.preventDefault();
        moveToWeekBoundary('end');
        break;
    }
  }

  /** Dialog-level keyboard handler for Escape key dismissal. */
  function handleDialogKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeCalendar(true);
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (isOpen && containerEl && !containerEl.contains(event.target as Node)) {
      closeCalendar(false);
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="nui-datepicker" bind:this={containerEl}>
  {#if label}
    <label class="nui-datepicker__label" id={labelId} for={controlId}>
      {label}
    </label>
  {/if}

  <button
    bind:this={triggerEl}
    id={controlId}
    type="button"
    class="nui-datepicker__control"
    class:is-active={isOpen}
    class:is-invalid={isValueInvalid}
    {disabled}
    onclick={toggleCalendar}
    aria-haspopup="dialog"
    aria-expanded={isOpen}
    aria-controls={isOpen ? calendarId : undefined}
    aria-labelledby={labelId}
    aria-label={resolvedAriaLabel}
  >
    <span class="nui-datepicker__text" class:is-placeholder={!validValue}>
      {validValue || placeholder}
    </span>
    <span class="nui-datepicker__icon" aria-hidden="true">📅</span>
  </button>

  {#if isOpen}
    <div
      bind:this={calendarEl}
      id={calendarId}
      class="nui-datepicker__calendar"
      role="dialog"
      aria-modal="false"
      aria-label={label ? `${label} calendar` : 'Calendar'}
      tabindex="-1"
      onkeydown={handleDialogKeyDown}
    >
      <div class="nui-datepicker__header">
        <button
          type="button"
          class="nui-datepicker__nav"
          disabled={!canPrevMonth}
          onclick={prevMonth}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span class="nui-datepicker__month" aria-live="polite">
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          class="nui-datepicker__nav"
          disabled={!canNextMonth}
          onclick={nextMonth}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <table
        class="nui-datepicker__table"
        role="grid"
        aria-label="{monthNames[viewMonth]} {viewYear}"
        onkeydown={handleGridKeyDown}
      >
        <thead>
          <tr>
            {#each daysOfWeek as day}
              <th class="nui-datepicker__day-header" scope="col">{day}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each calendarWeeks as week, wIdx (`week-${wIdx}`)}
            <tr>
              {#each week as cell, cIdx (`cell-${wIdx}-${cIdx}`)}
                {#if cell.empty}
                  <td class="nui-datepicker__day-empty" role="gridcell" aria-hidden="true"></td>
                {:else}
                  {@const isSelected = validValue === cell.dateStr}
                  {@const isToday = cell.dateStr === todayStr}
                  {@const isFocused = cell.dateStr === focusedDateStr}
                  <td class="nui-datepicker__cell" role="gridcell" aria-selected={isSelected ? 'true' : 'false'}>
                    <button
                      type="button"
                      class="nui-datepicker__day"
                      class:nui-datepicker__day--selected={isSelected}
                      class:nui-datepicker__day--today={isToday}
                      class:nui-datepicker__day--focused={isFocused}
                      data-date={cell.dateStr}
                      disabled={cell.disabled}
                      tabindex={isFocused ? 0 : -1}
                      aria-current={isToday ? 'date' : undefined}
                      onclick={() => cell.dateStr && selectDate(cell.dateStr)}
                    >
                      {cell.day}
                    </button>
                  </td>
                {/if}
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .nui-datepicker {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .nui-datepicker__label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--nui-fg, #fafafa);
    opacity: 0.85;
    cursor: pointer;
  }

  .nui-datepicker__control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    background: var(--nui-surface-alt, #101012);
    color: var(--nui-fg, #fafafa);
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    box-sizing: border-box;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .nui-datepicker__control:hover:not(:disabled),
  .nui-datepicker__control.is-active {
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-datepicker__control.is-invalid {
    border-color: var(--nui-danger, #ef4444);
  }

  .nui-datepicker__control.is-invalid:focus-visible {
    outline-color: var(--nui-danger, #ef4444);
  }

  .nui-datepicker__control:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-datepicker__control:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nui-datepicker__text {
    flex: 1;
    text-align: left;
  }

  .nui-datepicker__text.is-placeholder {
    color: var(--nui-fg-secondary, #a1a1aa);
    opacity: 0.7;
  }

  .nui-datepicker__icon {
    font-size: 0.95rem;
    opacity: 0.75;
    user-select: none;
  }

  .nui-datepicker__calendar {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    padding: 0.875rem;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.5rem);
    background: var(--nui-surface, #18181b);
    box-shadow: 0 10px 25px rgb(0 0 0 / 0.45);
    z-index: var(--nui-z-dropdown, 100);
    width: 17.5rem;
    box-sizing: border-box;
  }

  .nui-datepicker__calendar:focus-visible {
    outline: none;
  }

  .nui-datepicker__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .nui-datepicker__nav {
    background: transparent;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: 50%;
    width: 1.75rem;
    height: 1.75rem;
    font-size: 1rem;
    color: var(--nui-fg, #fafafa);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .nui-datepicker__nav:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.08));
    border-color: var(--nui-border-hover, #52525b);
  }

  .nui-datepicker__nav:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 1px;
  }

  .nui-datepicker__nav:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .nui-datepicker__month {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--nui-fg, #fafafa);
  }

  .nui-datepicker__table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
  }

  .nui-datepicker__day-header {
    color: var(--nui-fg-secondary, #a1a1aa);
    font-size: 0.75rem;
    font-weight: 600;
    text-align: center;
    padding: 0.25rem 0;
    user-select: none;
  }

  .nui-datepicker__cell {
    padding: 0.1rem;
    text-align: center;
  }

  .nui-datepicker__day-empty {
    padding: 0.1rem;
    width: 2rem;
    height: 2rem;
  }

  .nui-datepicker__day {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: var(--nui-radius, 0.25rem);
    background: transparent;
    color: var(--nui-fg, #fafafa);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, border-color 0.15s ease;
    box-sizing: border-box;
  }

  .nui-datepicker__day:hover:not(:disabled):not(.nui-datepicker__day--selected) {
    background: var(--nui-hover, rgb(255 255 255 / 0.1));
  }

  .nui-datepicker__day:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 1px;
    z-index: 1;
  }

  .nui-datepicker__day:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }

  .nui-datepicker__day--today:not(.nui-datepicker__day--selected) {
    border-color: var(--nui-primary, #3b82f6);
    font-weight: 600;
  }

  .nui-datepicker__day--selected {
    background: var(--nui-primary, #3b82f6) !important;
    border-color: var(--nui-primary, #3b82f6) !important;
    color: #fff !important;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-datepicker__control,
    .nui-datepicker__nav,
    .nui-datepicker__day {
      transition: none;
    }
  }
</style>
