<!--
  @component NuiBadge
  Status badge and notification counter component.
-->
<script lang="ts">
  interface Props {
    /** Text or snippet content rendered inside the badge. */
    children?: import("svelte").Snippet;
    /**
     * Numerical counter value (e.g. notification count).
     * Negative, non-numeric, or infinite values are normalized to 0.
     * @defaultValue 0
     */
    count?: number;
    /**
     * Whether to display the counter when count is 0.
     * When false (default), a count of 0 falls back to children or a dot indicator.
     * @defaultValue false
     */
    showZero?: boolean;
    /**
     * Maximum displayed counter value (e.g. 99 displays as "99+").
     * @defaultValue 99
     */
    maxCount?: number;
    /**
     * Color variant.
     * @defaultValue 'primary'
     */
    variant?:
      | "primary"
      | "secondary"
      | "success"
      | "warning"
      | "danger"
      | "info";
    /**
     * Size of the badge.
     * @defaultValue 'md'
     */
    size?: "xs" | "sm" | "md" | "lg";
    /**
     * Outline style with transparent background and colored border.
     * @defaultValue false
     */
    outline?: boolean;
    /**
     * Pill-shaped rounded borders.
     * @defaultValue true
     */
    rounded?: boolean;
    /**
     * Visibility of the badge.
     * @defaultValue true
     */
    visible?: boolean;
    /**
     * Whether the badge is interactive (automatically true when onclick is provided).
     * @defaultValue false
     */
    clickable?: boolean;
    /**
     * Whether the clickable badge is disabled.
     * @defaultValue false
     */
    disabled?: boolean;
    /**
     * Accessible description for screen readers.
     * Recommended for interactive badges or badges displaying only symbols/numbers.
     */
    ariaLabel?: string;
    /**
     * Optional role (defaults to "status" when ariaLabel is provided on a non-interactive <span>).
     */
    role?: string;
    /** Click event handler. */
    onclick?: (event: MouseEvent) => void;
  }

  let {
    children,
    count = 0,
    showZero = false,
    maxCount = 99,
    variant = "primary",
    size = "md",
    outline = false,
    rounded = true,
    visible = true,
    clickable = false,
    disabled = false,
    ariaLabel,
    role,
    onclick,
  }: Props = $props();

  const normalizedCount = $derived(
    Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0,
  );
  const normalizedMaxCount = $derived(
    Number.isFinite(maxCount) ? Math.max(1, Math.floor(maxCount)) : 99,
  );
  const showCount = $derived(
    normalizedCount > 0 || (showZero && count !== undefined),
  );
  const displayCount = $derived(
    normalizedCount > normalizedMaxCount
      ? `${normalizedMaxCount}+`
      : normalizedCount,
  );
  const isClickable = $derived(clickable || typeof onclick === "function");
  const resolvedRole = $derived(
    role ?? (ariaLabel && !isClickable ? "status" : undefined),
  );
</script>

{#if visible}
  {#if isClickable}
    <button
      type="button"
      class="nui-badge nui-badge--{variant} nui-badge--{size} nui-badge--clickable"
      class:nui-badge--outline={outline}
      class:nui-badge--rounded={rounded}
      class:nui-badge--square={!rounded}
      aria-label={ariaLabel}
      {disabled}
      {onclick}
    >
      {#if showCount}
        {displayCount}
      {:else if children}
        {@render children()}
      {:else}
        <span aria-hidden="true">●</span>
      {/if}
    </button>
  {:else}
    <span
      class="nui-badge nui-badge--{variant} nui-badge--{size}"
      class:nui-badge--outline={outline}
      class:nui-badge--rounded={rounded}
      class:nui-badge--square={!rounded}
      aria-label={ariaLabel}
      role={resolvedRole}
    >
      {#if showCount}
        {displayCount}
      {:else if children}
        {@render children()}
      {:else}
        <span aria-hidden="true">●</span>
      {/if}
    </span>
  {/if}
{/if}

<style>
  .nui-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font: inherit;
    font-weight: 600;
    line-height: 1;
    text-align: center;
    border: 1px solid transparent;
    transition:
      opacity 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
    box-sizing: border-box;
    vertical-align: middle;
  }

  button.nui-badge {
    appearance: none;
    -webkit-appearance: none;
    color: inherit;
    padding: 0;
    cursor: pointer;
  }

  button.nui-badge:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }

  .nui-badge--clickable {
    cursor: pointer;
  }

  .nui-badge--clickable:hover:not(:disabled) {
    opacity: 0.85;
  }

  .nui-badge--clickable:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nui-badge--primary {
    background: var(--nui-primary, #3b82f6);
    color: #fff;
  }
  .nui-badge--secondary {
    background: var(--nui-surface-alt, #3f3f46);
    color: var(--nui-fg, #fafafa);
  }
  .nui-badge--success {
    background: var(--nui-success, #22c55e);
    color: #fff;
  }
  .nui-badge--warning {
    background: var(--nui-warning, #f59e0b);
    color: #18181b;
  }
  .nui-badge--danger {
    background: var(--nui-danger, #ef4444);
    color: #fff;
  }
  .nui-badge--info {
    background: var(--nui-info, #06b6d4);
    color: #fff;
  }

  .nui-badge.nui-badge--outline {
    background: transparent;
  }
  .nui-badge.nui-badge--outline.nui-badge--primary {
    border-color: var(--nui-primary, #3b82f6);
    color: var(--nui-primary, #3b82f6);
  }
  .nui-badge.nui-badge--outline.nui-badge--secondary {
    border-color: var(--nui-border, #3f3f46);
    color: var(--nui-fg-secondary, #8b8b99);
  }
  .nui-badge.nui-badge--outline.nui-badge--success {
    border-color: var(--nui-success, #22c55e);
    color: var(--nui-success, #22c55e);
  }
  .nui-badge.nui-badge--outline.nui-badge--warning {
    border-color: var(--nui-warning, #f59e0b);
    color: var(--nui-warning, #f59e0b);
  }
  .nui-badge.nui-badge--outline.nui-badge--danger {
    border-color: var(--nui-danger, #ef4444);
    color: var(--nui-danger, #ef4444);
  }
  .nui-badge.nui-badge--outline.nui-badge--info {
    border-color: var(--nui-info, #06b6d4);
    color: var(--nui-info, #06b6d4);
  }

  .nui-badge--xs {
    padding: 0.125rem 0.35rem;
    font-size: 0.625rem;
  }
  .nui-badge--sm {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }
  .nui-badge--md {
    padding: 0.3rem 0.65rem;
    font-size: 0.8125rem;
  }
  .nui-badge--lg {
    padding: 0.4rem 0.85rem;
    font-size: 0.9375rem;
  }

  .nui-badge--rounded {
    border-radius: 9999px;
  }
  .nui-badge--square {
    border-radius: var(--nui-radius, 0.25rem);
  }
</style>
