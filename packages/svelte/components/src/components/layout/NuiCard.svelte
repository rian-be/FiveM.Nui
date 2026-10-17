<script lang="ts" module>
  let warnedNoAccessibleName = false;
</script>

<script lang="ts">
  import { DEV } from 'esm-env';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
    /** Card header title */
    title?: string;
    /** Optional icon displayed before the title */
    icon?: string;
    /** Card elevation level (1 to 5) */
    elevation?: 1 | 2 | 3 | 4 | 5 | '1' | '2' | '3' | '4' | '5';
    /**
     * Whether the card can be toggled/selected.
     * When true and not `controlled`, clicking toggles `selected` (supports `bind:selected`).
     * For single-select card groups (radio behavior), set `controlled={true}` and update `selected` via `onSelect`.
     */
    selectable?: boolean;
    /**
     * Whether the card is currently selected.
     * Supports two-way binding via `bind:selected` when `controlled` is false.
     */
    selected?: boolean;
    /**
     * When true, the parent owns the `selected` state; the card will not mutate `selected` locally upon click.
     * Do not use `bind:selected` together with `controlled={true}`.
     * @default false
     */
    controlled?: boolean;
    /** Whether the card behaves as a clickable button */
    clickable?: boolean;
    /**
     * Whether the card is disabled.
     * When true, disables the interactive card overlay (if interactive) and marks `actions` and `children` as `inert`.
     * Note: `inert` is applied to `actions` and `children` even on non-interactive cards to suppress descendant interactivity.
     */
    disabled?: boolean;
    /** Accessible name for the interactive card when there is no title */
    label?: string;
    /** Heading level for the card title (defaults to 3 -> <h3>) */
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6 | (number & {});
    /** Callback fired when the card is clicked or activated via keyboard. For `selectable` cards, also receives the intended next selection state. */
    onSelect?: (event: MouseEvent | KeyboardEvent, nextSelected?: boolean) => void;
    /** Card body content snippet */
    children?: Snippet;
    /** Header action buttons or badges snippet */
    actions?: Snippet;
  }

  const uid = $props.id();
  const titleId = `nui-card-${uid}-title`;

  let {
    title = '',
    icon = '',
    elevation = 1,
    selectable = false,
    selected = $bindable(false),
    controlled = false,
    clickable = false,
    disabled = false,
    label,
    headingLevel = 3,
    onSelect,
    children,
    actions,
    class: className = '',
    role: roleProp,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    ...rest
  }: Props = $props();

  const interactive = $derived(selectable || clickable || Boolean(onSelect));
  const computedAriaLabelledby = $derived(title ? titleId : ariaLabelledby);
  const computedAriaLabel = $derived(
    computedAriaLabelledby ? undefined : (label ?? ariaLabel)
  );

  const safeHeadingTag = $derived.by(() => {
    const level = Number(headingLevel);
    if (Number.isInteger(level) && level >= 1 && level <= 6) {
      return `h${level}`;
    }
    return 'h3';
  });

  // Warn once in development mode if an interactive card lacks an accessible name
  $effect(() => {
    if (!DEV || warnedNoAccessibleName) return;
    if (interactive && !computedAriaLabel && !computedAriaLabelledby) {
      warnedNoAccessibleName = true;
      console.warn(
        '[fivem-nui-components] NuiCard: Interactive card must have an accessible name. Provide a `title`, `label`, or `aria-label`.'
      );
    }
  });

  function handleClick(event: MouseEvent | KeyboardEvent) {
    if (disabled) return;
    if (selectable) {
      const next = !selected;
      if (!controlled) {
        selected = next;
      }
      onSelect?.(event, next);
    } else {
      onSelect?.(event);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event);
    }
  }
</script>

<div
  {...rest}
  role={roleProp ?? (!interactive && (ariaLabel || ariaLabelledby) ? 'group' : undefined)}
  aria-label={!interactive ? ariaLabel : undefined}
  aria-labelledby={!interactive ? ariaLabelledby : undefined}
  class={['nui-card', `nui-card--elevation-${elevation}`, className]}
  class:nui-card--interactive={interactive}
  class:nui-card--selected={selectable && selected}
  class:nui-card--disabled={disabled}
>
  {#if interactive}
    <button
      type="button"
      class="nui-card-hit"
      {disabled}
      aria-pressed={selectable ? selected : undefined}
      aria-labelledby={computedAriaLabelledby}
      aria-label={computedAriaLabel}
      onclick={handleClick}
      onkeydown={handleKeyDown}
    ></button>
  {/if}

  {#if title || icon || actions}
    <div class="nui-card-header">
      {#if icon}<span class="nui-card-icon" aria-hidden="true">{icon}</span>{/if}
      {#if title}
        <svelte:element this={safeHeadingTag} id={titleId} class="nui-card-title">
          {title}
        </svelte:element>
      {/if}
      {#if actions}
        <div class="nui-card-actions" inert={disabled || undefined}>{@render actions()}</div>
      {/if}
    </div>
  {/if}

  {#if children}
    <div class="nui-card-body" inert={disabled || undefined}>{@render children()}</div>
  {/if}
</div>

<style>
  .nui-card {
    position: relative;
    background: var(--nui-surface, #18181b);
    color: var(--nui-fg, #fafafa);
    border: 1px solid var(--nui-border, #27272a);
    border-radius: var(--nui-radius, 0.5rem);
    padding: 1rem;
    box-sizing: border-box;
    font-family: inherit;
    box-shadow: var(--nui-card-shadow);
    transition: transform 0.15s ease, border-color 0.15s ease,
      opacity 0.15s ease, box-shadow 0.15s ease;
  }

  .nui-card--elevation-1 { --nui-card-shadow: 0 1px 3px rgb(0 0 0 / 0.12); }
  .nui-card--elevation-2 { --nui-card-shadow: 0 3px 6px rgb(0 0 0 / 0.16); }
  .nui-card--elevation-3 { --nui-card-shadow: 0 10px 20px rgb(0 0 0 / 0.19); }
  .nui-card--elevation-4 { --nui-card-shadow: 0 20px 40px rgb(0 0 0 / 0.23); }
  .nui-card--elevation-5 { --nui-card-shadow: 0 30px 60px rgb(0 0 0 / 0.3); }

  .nui-card--interactive:not(.nui-card--disabled):hover {
    transform: translateY(-2px);
    border-color: var(--nui-primary, #3b82f6);
    z-index: 2;
  }

  .nui-card:focus-within {
    z-index: 2;
  }

  .nui-card--interactive:not(.nui-card--disabled):active {
    transform: none;
  }

  .nui-card--selected {
    border-color: var(--nui-primary, #3b82f6);
    box-shadow: inset 0 0 0 1px var(--nui-primary, #3b82f6), var(--nui-card-shadow);
  }

  .nui-card--disabled {
    opacity: 0.5;
  }

  /* Fallback for environments lacking native inert support */
  .nui-card--disabled .nui-card-actions,
  .nui-card--disabled .nui-card-body {
    pointer-events: none;
  }

  .nui-card-hit {
    position: absolute;
    inset: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: inherit;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }

  /* Overlay expands -2px only during hover to eliminate jitter without overlapping adjacent cards at rest */
  .nui-card--interactive:not(.nui-card--disabled):hover .nui-card-hit {
    bottom: -2px;
  }

  .nui-card-hit:disabled {
    cursor: not-allowed;
  }

  .nui-card-hit:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .nui-card-header:last-child {
    margin-bottom: 0;
  }

  .nui-card-icon {
    font-size: 1.25rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .nui-card-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    flex: 1;
    color: inherit;
  }

  /* Above overlay so actions, interactive content, and user-marked elements receive direct pointer/keyboard focus */
  .nui-card-actions {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 0.375rem;
  }

  .nui-card-body {
    font-size: 0.875rem;
    color: inherit;
  }

  .nui-card-body :global(:is(
    a,
    button,
    input,
    select,
    textarea,
    label,
    summary,
    [tabindex],
    [role="button"],
    [role="checkbox"],
    [role="radio"],
    [role="switch"],
    [role="link"],
    [role="textbox"],
    [contenteditable],
    .nui-card-interactive
  )) {
    position: relative;
    z-index: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-card {
      transition: none;
    }
    .nui-card--interactive:hover {
      transform: none;
    }
  }
</style>
