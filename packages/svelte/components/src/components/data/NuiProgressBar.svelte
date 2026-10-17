<!--
  @component NuiProgressBar
  Accessible progress bar component with real-time NUI sync, custom colors, and percentage indicators.

  Data Precedence & Synchronization:
  - If `eventName` is specified, the component listens for incoming progress payloads (number or `{ value, max }`).
  - Incoming NUI updates take precedence over initial `value`/`max` props.
  - If the parent component changes `value`, `max`, or `eventName` props, remote overrides are reset.

  Completion Contract:
  - Completion is detected when `safeValue >= safeMax` (not by rounded percent).
  - Fires `onComplete` and emits `completeEvent` once when reaching 100%.
  - If progress drops below 100% and reaches 100% again, the completion handlers are re-triggered.

  Label Behavior:
  - `labelPosition === 'top'` renders the label above the track on the left, with percentage on the right.
  - `labelPosition === 'inside'` renders the text label inside the progress fill, while percentage (if enabled) remains above the track.
-->
<script lang="ts">
  import { nui } from '@fivem-nui/svelte';
  import type { SvelteNuiClient } from '@fivem-nui/svelte';

  type MaybePromise<T> = T | Promise<T>;

  interface Props {
    /** Current progress value. */
    value?: number;
    /** Maximum progress value. Defaults to 100 if <= 0, NaN, or non-finite. */
    max?: number;
    /** Text label describing the progress (e.g. "Downloading resources"). */
    label?: string;
    /** Custom CSS color override for the fill bar. */
    color?: string;
    /** Whether to display the percentage number. */
    showPercentage?: boolean;
    /** Position of the text label ('top' above track, 'inside' within fill bar). */
    labelPosition?: 'top' | 'inside';
    /** Sizing density. */
    size?: 'sm' | 'md' | 'lg';
    /** Color palette variant. */
    variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
    /** Optional NUI event name to listen for progress updates from the game backend. */
    eventName?: string;
    /** Optional NUI event name sent to the game backend once progress reaches 100%. */
    completeEvent?: string;
    /** Callback executed when progress reaches 100% (safe for sync or async). */
    onComplete?: () => MaybePromise<void>;
    /** Accessible label for screen readers (defaults to label or "Progress"). */
    ariaLabel?: string;
    /** SvelteNuiClient instance for event transport. */
    client?: SvelteNuiClient;
  }

  let {
    value = 0,
    max = 100,
    label,
    color,
    showPercentage = false,
    labelPosition = 'top',
    size = 'md',
    variant = 'primary',
    eventName,
    completeEvent,
    onComplete,
    ariaLabel,
    client = nui
  }: Props = $props();

  let remoteValue = $state<number | null>(null);
  let remoteMax = $state<number | null>(null);

  let lastPropsValue = value;
  let lastPropsMax = max;
  let lastEventName = eventName;

  // Reset remote overrides when parent updates props or switches eventName
  $effect(() => {
    if (value !== lastPropsValue || max !== lastPropsMax || eventName !== lastEventName) {
      lastPropsValue = value;
      lastPropsMax = max;
      lastEventName = eventName;
      remoteValue = null;
      remoteMax = null;
    }
  });

  // Listen for real-time progress updates from NUI game client
  $effect(() => {
    if (!eventName || !client) return;
    const unsub = client.on(eventName, (payload: unknown) => {
      if (typeof payload === 'number' && Number.isFinite(payload)) {
        remoteValue = payload;
      } else if (payload && typeof payload === 'object') {
        const obj = payload as Record<string, unknown>;
        if (typeof obj.value === 'number' && Number.isFinite(obj.value)) {
          remoteValue = obj.value;
        }
        if (typeof obj.max === 'number' && Number.isFinite(obj.max)) {
          remoteMax = obj.max;
        }
      }
    });
    return () => unsub();
  });

  const activeValue = $derived(remoteValue ?? value);
  const activeMax = $derived(remoteMax ?? max);

  const safeMax = $derived(
    typeof activeMax === 'number' && Number.isFinite(activeMax) && activeMax > 0
      ? activeMax
      : 100
  );

  const safeValue = $derived(
    typeof activeValue === 'number' && Number.isFinite(activeValue)
      ? Math.max(0, Math.min(safeMax, activeValue))
      : 0
  );

  const clampedPercent = $derived(
    safeMax > 0 ? Math.min(100, Math.max(0, Math.round((safeValue / safeMax) * 100))) : 0
  );

  const isComplete = $derived(safeValue >= safeMax);

  let hasCompleted = $state(false);

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

  $effect(() => {
    if (isComplete) {
      if (!hasCompleted) {
        hasCompleted = true;
        if (completeEvent) {
          try {
            client.send(completeEvent, { value: safeValue, max: safeMax });
          } catch (err) {
            console.error(`[fivem-nui-components] Failed to send completeEvent '${completeEvent}':`, err);
          }
        }
        safeCall(() => onComplete?.(), '[fivem-nui-components] onComplete callback error:');
      }
    } else {
      hasCompleted = false;
    }
  });

  const resolvedAriaLabel = $derived(ariaLabel || label || 'Progress');
  const resolvedAriaValueText = $derived(`${clampedPercent}%`);
</script>

<div class="nui-progress-bar nui-progress-bar--{size}">
  {#if (label && labelPosition === 'top') || showPercentage}
    <div class="nui-progress-bar__label">
      {#if label && labelPosition === 'top'}
        <span>{label}</span>
      {/if}
      {#if showPercentage}
        <span class="nui-progress-bar__percent">{clampedPercent}%</span>
      {/if}
    </div>
  {/if}

  <div
    class="nui-progress-bar__track"
    role="progressbar"
    aria-label={resolvedAriaLabel}
    aria-valuenow={safeValue}
    aria-valuemin={0}
    aria-valuemax={safeMax}
    aria-valuetext={resolvedAriaValueText}
  >
    <div
      class="nui-progress-bar__fill nui-progress-bar__fill--{variant}"
      style:width="{clampedPercent}%"
      style:background={color || undefined}
      aria-hidden="true"
    >
      {#if label && labelPosition === 'inside'}
        <span class="nui-progress-bar__inner-label">
          {label}
        </span>
      {/if}
    </div>
  </div>
</div>

<style>
  .nui-progress-bar {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
  }

  .nui-progress-bar__label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    color: var(--nui-fg, #fafafa);
    opacity: 0.85;
    line-height: 1.2;
  }

  .nui-progress-bar__percent {
    font-weight: 600;
    margin-left: auto;
  }

  .nui-progress-bar__track {
    width: 100%;
    background: var(--nui-surface-alt, #27272a);
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
  }

  .nui-progress-bar--sm .nui-progress-bar__track { height: 0.75rem; }
  .nui-progress-bar--md .nui-progress-bar__track { height: 1.25rem; }
  .nui-progress-bar--lg .nui-progress-bar__track { height: 1.75rem; }

  .nui-progress-bar__fill {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: width 0.3s ease;
    border-radius: inherit;
  }

  .nui-progress-bar__fill--primary { background: var(--nui-primary, #3b82f6); }
  .nui-progress-bar__fill--secondary { background: var(--nui-secondary, #8b8b99); }
  .nui-progress-bar__fill--success { background: var(--nui-success, #22c55e); }
  .nui-progress-bar__fill--warning { background: var(--nui-warning, #f59e0b); }
  .nui-progress-bar__fill--danger { background: var(--nui-danger, #ef4444); }

  .nui-progress-bar__inner-label {
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0 0.5rem;
    white-space: nowrap;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
</style>
