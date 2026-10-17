<script module lang="ts">
  export type PageItem = number | "ellipsis-start" | "ellipsis-end";

  /**
   * Returns a stable-width list of page items.
   * Always renders `slots` items (when total > slots): first, last, current window and ellipses.
   */
  export function getPageItems(
    total: number,
    current: number,
    maxVisible: number,
    ellipsis: boolean,
  ): PageItem[] {
    const tot = Math.max(1, Number.isFinite(total) ? Math.floor(total) : 1);
    const slots = Math.max(
      5,
      Number.isFinite(maxVisible) ? Math.floor(maxVisible) : 5,
    );
    const cur = Math.min(Math.max(1, Math.floor(current) || 1), tot);

    if (tot <= slots) return Array.from({ length: tot }, (_, i) => i + 1);

    // Without ellipses we simply slide a window of `slots` pages
    if (!ellipsis) {
      const start = Math.min(
        Math.max(1, cur - Math.floor(slots / 2)),
        tot - slots + 1,
      );
      return Array.from({ length: slots }, (_, i) => start + i);
    }

    const inner = slots - 2; // slots minus first and last
    const nearStart = cur <= Math.ceil(slots / 2);
    const nearEnd = cur > tot - Math.ceil(slots / 2);

    if (nearStart) {
      const pages = Array.from({ length: inner }, (_, i) => i + 1);
      return [...pages, "ellipsis-end", tot];
    }

    if (nearEnd) {
      const start = tot - inner + 1;
      const pages = Array.from({ length: inner }, (_, i) => start + i);
      return [1, "ellipsis-start", ...pages];
    }

    const middle = inner - 2; // minus two ellipses
    const start = cur - Math.floor((middle - 1) / 2);
    const pages = Array.from({ length: middle }, (_, i) => start + i);
    return [1, "ellipsis-start", ...pages, "ellipsis-end", tot];
  }
</script>

<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  interface Labels {
    nav: string;
    first: string;
    previous: string;
    next: string;
    last: string;
    page: (n: number) => string;
    status: (page: number, total: number) => string;
  }

  interface Props extends Omit<HTMLAttributes<HTMLElement>, "children"> {
    /** Total number of items */
    totalItems: number;
    /** Items per page */
    pageSize?: number;
    /** Current page (1-based). Supports `bind:page` */
    page?: number;
    /** Number of slots in the list (min 5). The width stays stable while navigating */
    maxPages?: number;
    /** Show first/last buttons */
    showFirstLast?: boolean;
    /** Show ellipses for skipped ranges. When false, a sliding window is used */
    showEllipsis?: boolean;
    /**
     * Called after the page changed through direct user interaction (clicking a page button or next/prev).
     * Note: programmatic adjustments (such as clamp adjustments via $effect when `totalItems` decreases) do not trigger this callback.
     */
    onChange?: (page: number) => void;
    /** Override texts (localization / accessibility) */
    labels?: Partial<Labels>;
  }

  const defaultLabels: Labels = {
    nav: "Pagination",
    first: "First page",
    previous: "Previous page",
    next: "Next page",
    last: "Last page",
    page: (n) => `Page ${n}`,
    status: (p, t) => `Page ${p} of ${t}`,
  };

  let {
    totalItems,
    pageSize = 10,
    page = $bindable(1),
    maxPages = 7,
    showFirstLast = true,
    showEllipsis = true,
    onChange,
    labels,
    class: className = "",
    ...rest
  }: Props = $props();

  const t = $derived({ ...defaultLabels, ...labels });

  const safeSize = $derived(
    Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : 10,
  );
  const safeItems = $derived(
    Number.isFinite(totalItems) && totalItems > 0 ? totalItems : 0,
  );
  const totalPages = $derived(Math.max(1, Math.ceil(safeItems / safeSize)));
  const current = $derived(
    Math.min(Math.max(1, Math.floor(page) || 1), totalPages),
  );

  const items = $derived(
    getPageItems(totalPages, current, maxPages, showEllipsis),
  );

  // Keep the bound value valid after totalItems/pageSize shrink
  $effect(() => {
    if (page !== current) page = current;
  });

  function goToPage(next: number) {
    if (next < 1 || next > totalPages || next === current) return;
    page = next;
    onChange?.(next);
  }
</script>

<nav {...rest} class={["nui-pagination", className]} aria-label={t.nav}>
  <span class="nui-pagination__info" aria-live="polite">
    {t.status(current, totalPages)}
  </span>

  <ol class="nui-pagination__list">
    {#if showFirstLast}
      <li>
        <button
          type="button"
          class="nui-pagination__btn nui-pagination__btn--edge"
          aria-label={t.first}
          disabled={current === 1}
          onclick={() => goToPage(1)}
        >
          <span aria-hidden="true">«</span>
        </button>
      </li>
    {/if}

    <li>
      <button
        type="button"
        class="nui-pagination__btn"
        aria-label={t.previous}
        disabled={current === 1}
        onclick={() => goToPage(current - 1)}
      >
        <span aria-hidden="true">‹</span>
      </button>
    </li>

    {#each items as item (item)}
      {#if typeof item === "string"}
        <li class="nui-pagination__ellipsis" aria-hidden="true">…</li>
      {:else}
        <li>
          <button
            type="button"
            class="nui-pagination__btn"
            class:nui-pagination__btn--active={item === current}
            aria-label={t.page(item)}
            aria-current={item === current ? "page" : undefined}
            onclick={() => goToPage(item)}
          >
            {item}
          </button>
        </li>
      {/if}
    {/each}

    <li>
      <button
        type="button"
        class="nui-pagination__btn"
        aria-label={t.next}
        disabled={current === totalPages}
        onclick={() => goToPage(current + 1)}
      >
        <span aria-hidden="true">›</span>
      </button>
    </li>

    {#if showFirstLast}
      <li>
        <button
          type="button"
          class="nui-pagination__btn nui-pagination__btn--edge"
          aria-label={t.last}
          disabled={current === totalPages}
          onclick={() => goToPage(totalPages)}
        >
          <span aria-hidden="true">»</span>
        </button>
      </li>
    {/if}
  </ol>
</nav>

<style>
  .nui-pagination {
    --_size: var(--nui-pagination-size, 2.5rem);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-pagination__info {
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .nui-pagination__list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nui-pagination__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--_size);
    height: var(--_size);
    padding: 0;
    background: transparent;
    color: inherit;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: 0.25rem;
    font: inherit;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .nui-pagination__btn:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
  }

  .nui-pagination__btn:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-pagination__btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-pagination__btn--active {
    background: var(--nui-primary, #3b82f6);
    border-color: var(--nui-primary, #3b82f6);
    color: var(--nui-primary-fg, #fff);
  }

  .nui-pagination__btn--active:hover:not(:disabled) {
    background: var(--nui-primary, #3b82f6);
  }

  .nui-pagination__btn--edge {
    width: calc(var(--_size) * 0.8);
    font-size: 0.75rem;
  }

  .nui-pagination__ellipsis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--_size);
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-pagination__btn {
      transition: none;
    }
  }
</style>
