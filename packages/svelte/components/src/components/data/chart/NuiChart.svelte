<!--
  @component NuiChart
  Canvas chart component (bar, line, pie, doughnut) for FiveM NUI.
-->
<script module lang="ts">
  export type {
    ChartData,
    ChartDataset,
    ChartOptions,
    ChartType,
  } from "./types";
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { nui } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";
  import type {
    ChartData,
    ChartDataset,
    ChartOptions,
    ChartType,
  } from "./types";
  import { getColor } from "./color";
  import { validateChartData } from "./validator";
  import { renderChart } from "./registry";

  /**
   * Props for {@link NuiChart} component.
   */
  interface Props {
    /**
     * Chart type determining the rendering strategy.
     * Supported built-in types: `'bar'`, `'line'`, `'pie'`, `'doughnut'` or custom types.
     */
    type: ChartType;

    /**
     * Source chart data passed from parent.
     */
    data: ChartData;

    /**
     * Container width in pixels or CSS units.
     * @defaultValue '100%'
     */
    width?: number | string;

    /**
     * Canvas height in pixels or CSS units.
     * @defaultValue '300px'
     */
    height?: number | string;

    /**
     * Optional configuration for grid, Y-scale, legend position, and accessibility.
     * @defaultValue {}
     */
    options?: ChartOptions;

    /**
     * Optional NUI event name (from game / C#).
     * When provided, automatically listens for chart updates from NUI.
     */
    eventName?: string;

    /**
     * SvelteNuiClient instance to listen for game events.
     * @defaultValue singleton `nui` from `@fivem-nui/svelte`
     */
    client?: SvelteNuiClient;
  }

  let {
    type,
    data,
    width = "100%",
    height = "300px",
    options = {},
    eventName,
    client = nui,
  }: Props = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let containerEl = $state<HTMLDivElement | null>(null);
  let rafId: number | null = null;

  // Data sources: separation of parent props, NUI events, and local visibility state
  let remoteData = $state<ChartData | null>(null);
  let hiddenIndices = $state<Record<number, boolean>>({});
  let lastPropsData: ChartData | null = null;

  // New parent props reset remote overrides and local hidden states
  $effect(() => {
    if (data !== lastPropsData) {
      lastPropsData = data;
      remoteData = null;
      hiddenIndices = {};
    }
  });

  // Listen for NUI updates with runtime validation
  $effect(() => {
    if (!eventName || !client) return;
    const unsub = client.on(eventName, (payload: unknown) => {
      const validation = validateChartData(payload);
      if (validation.valid && validation.data) {
        remoteData = validation.data;
        hiddenIndices = {};
      } else {
        console.warn(
          `[NuiChart] Rejected invalid payload from event '${eventName}':`,
          validation.error,
          payload,
        );
      }
    });
    return () => unsub();
  });

  // Effective data combining remote overrides and local visibility toggles
  const activeRawData = $derived(remoteData ?? data);
  const currentData = $derived<ChartData>({
    labels: activeRawData?.labels ?? [],
    datasets: (activeRawData?.datasets ?? []).map((ds, idx) => ({
      ...ds,
      hidden: hiddenIndices[idx] ?? ds.hidden ?? false,
    })),
  });

  // Common pie dataset used in renderer and legend
  const activePieDataset = $derived(
    currentData.datasets.find((d) => !d.hidden) ?? currentData.datasets[0],
  );

  /**
   * Schedules a render on the next animation frame.
   */
  function scheduleRender() {
    if (typeof window === "undefined") return;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const w = rect.width || (typeof width === "number" ? width : 400);
      const h = rect.height || (typeof height === "number" ? height : 300);
      renderChart(canvasEl, w, h, type, currentData, options);
    });
  }

  $effect(() => {
    void type;
    void currentData;
    void options;
    void width;
    void height;
    scheduleRender();
  });

  onMount(() => {
    scheduleRender();

    if (containerEl && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            scheduleRender();
          }
        }
      });
      ro.observe(containerEl);
      return () => {
        ro.disconnect();
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  });

  const legendPos = $derived(
    options.legend?.position ?? options.plugins?.legend?.position ?? "bottom",
  );
  const showLegend = $derived(legendPos !== "none");

  /** Accessible description for screen readers. */
  const resolvedAriaLabel = $derived.by(() => {
    if (options.ariaLabel) return options.ariaLabel;
    const labels = currentData.labels || [];
    const labelsSummary =
      labels.length > 5
        ? `${labels.slice(0, 5).join(", ")} and ${labels.length - 5} more`
        : labels.join(", ");
    return `Chart of type ${type}.${labels.length ? ` Categories: ${labelsSummary}` : ""}`;
  });

  /**
   * Toggles dataset visibility locally without mutating source data.
   */
  function toggleDataset(index: number) {
    const isCurrentlyHidden = currentData.datasets[index]?.hidden ?? false;
    hiddenIndices[index] = !isCurrentlyHidden;
  }
</script>

<div
  class="nui-chart-container"
  bind:this={containerEl}
  style="width: {typeof width === 'number' ? `${width}px` : width};"
>
  {#if showLegend && legendPos === "top"}
    <div class="nui-chart__legend nui-chart__legend--top">
      {#if type === "pie" || type === "doughnut"}
        {#if activePieDataset && !activePieDataset.hidden}
          {#each currentData.labels || [] as label, idx}
            {#if (activePieDataset.data[idx] ?? 0) > 0}
              <div class="nui-chart__legend-item">
                <span
                  class="nui-chart__legend-color"
                  style="background-color: {getColor(
                    activePieDataset.backgroundColor,
                    idx,
                  )}"
                ></span>
                <span class="nui-chart__legend-label">{label}</span>
              </div>
            {/if}
          {/each}
        {/if}
      {:else}
        {#each currentData.datasets as ds, idx}
          <button
            type="button"
            class="nui-chart__legend-btn"
            class:nui-chart__legend-btn--hidden={ds.hidden}
            aria-pressed={!ds.hidden}
            aria-label="{ds.hidden ? 'Show' : 'Hide'} series: {ds.label}"
            onclick={() => toggleDataset(idx)}
          >
            <span
              class="nui-chart__legend-color"
              style="background-color: {getColor(
                ds.borderColor || ds.backgroundColor,
                idx,
              )}"
            ></span>
            <span class="nui-chart__legend-label">{ds.label}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  <canvas
    bind:this={canvasEl}
    class="nui-chart"
    role="img"
    aria-label={resolvedAriaLabel}
    style="width: 100%; height: {typeof height === 'number'
      ? `${height}px`
      : height};"
  >
    <p>{resolvedAriaLabel}</p>
  </canvas>

  {#if showLegend && legendPos !== "top"}
    <div class="nui-chart__legend nui-chart__legend--bottom">
      {#if type === "pie" || type === "doughnut"}
        {#if activePieDataset && !activePieDataset.hidden}
          {#each currentData.labels || [] as label, idx}
            {#if (activePieDataset.data[idx] ?? 0) > 0}
              <div class="nui-chart__legend-item">
                <span
                  class="nui-chart__legend-color"
                  style="background-color: {getColor(
                    activePieDataset.backgroundColor,
                    idx,
                  )}"
                ></span>
                <span class="nui-chart__legend-label">{label}</span>
              </div>
            {/if}
          {/each}
        {/if}
      {:else}
        {#each currentData.datasets as ds, idx}
          <button
            type="button"
            class="nui-chart__legend-btn"
            class:nui-chart__legend-btn--hidden={ds.hidden}
            aria-pressed={!ds.hidden}
            aria-label="{ds.hidden ? 'Show' : 'Hide'} series: {ds.label}"
            onclick={() => toggleDataset(idx)}
          >
            <span
              class="nui-chart__legend-color"
              style="background-color: {getColor(
                ds.borderColor || ds.backgroundColor,
                idx,
              )}"
            ></span>
            <span class="nui-chart__legend-label">{ds.label}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .nui-chart-container {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-chart {
    display: block;
    border-radius: var(--nui-radius, 0.375rem);
    box-sizing: border-box;
  }

  .nui-chart__legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.25rem 0;
  }

  .nui-chart__legend-item,
  .nui-chart__legend-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--nui-muted, #a1a1aa);
    line-height: 1;
  }

  .nui-chart__legend-btn {
    background: transparent;
    border: none;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font: inherit;
    transition:
      opacity 0.15s ease,
      text-decoration 0.15s ease;
  }

  .nui-chart__legend-btn:hover {
    opacity: 0.8;
  }

  .nui-chart__legend-btn:focus-visible {
    outline: 2px solid var(--nui-primary, #6366f1);
    outline-offset: 2px;
  }

  .nui-chart__legend-btn--hidden {
    opacity: 0.4;
    text-decoration: line-through;
  }

  .nui-chart__legend-color {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 0.125rem;
    flex-shrink: 0;
  }

  .nui-chart__legend-label {
    line-height: 1;
  }
</style>
