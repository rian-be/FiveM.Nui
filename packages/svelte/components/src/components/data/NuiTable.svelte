<!--
  @component NuiTable
  Accessible, high-performance data table component supporting interactive sorting,
  search filtering, windowed pagination, and Svelte 5 cell snippets.
-->
<script module lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Column definition for {@link NuiTable}.
   */
  export interface Column<T = Record<string, unknown>> {
    /** Unique property key corresponding to row data. */
    key: string;
    /** Column header label. */
    header: string;
    /** Whether the column can be sorted by clicking the header. */
    sortable?: boolean;
    /** Text alignment in header and body cells. */
    align?: 'left' | 'center' | 'right';
    /** Custom Svelte 5 snippet for rendering rich cell content. */
    cell?: Snippet<[{ row: T; value: unknown; index: number }]>;
    /** Text/primitive formatter function. */
    format?: (value: unknown, row: T) => string | number;
    /** Legacy row render function returning formatted text or number. */
    render?: (row: T) => string | number;
  }

  export type NuiTableColumn<T = Record<string, unknown>> = Column<T>;
</script>

<script lang="ts">
  interface Props<T = Record<string, unknown>> {
    /** Column definitions. */
    columns?: Column<T>[];
    /** Array of row objects. */
    data?: T[];
    /** Sort expression ('key' for ascending, '-key' for descending). Supports two-way binding. */
    sort?: string;
    /** Number of rows per page. Defaults to 10. */
    pageSize?: number;
    /** Current 1-based page index. Supports two-way binding. */
    page?: number;
    /** Text query to filter rows across all columns. */
    searchQuery?: string;
    /** Whether to render pagination controls. Defaults to true. */
    pagination?: boolean;
    /** Message displayed when no rows are available. */
    emptyText?: string;
    /** Optional callback executed when sort state changes. */
    onSortChange?: (sort: string | undefined) => void;
  }

  let {
    columns = [],
    data = [],
    sort = $bindable(),
    pageSize = 10,
    page = $bindable(1),
    searchQuery = '',
    pagination = true,
    emptyText = 'No data available.',
    onSortChange
  }: Props = $props();

  const safePageSize = $derived(
    typeof pageSize === 'number' && Number.isFinite(pageSize) && pageSize > 0
      ? Math.floor(pageSize)
      : 10
  );

  const safeData = $derived(data ?? []);
  const safeColumns = $derived(columns ?? []);
  const filteredData = $derived(filterBySearch(safeData, searchQuery));
  const sortedData = $derived(sortRows(sort, filteredData));
  const totalPages = $derived(Math.max(1, Math.ceil(filteredData.length / safePageSize)));

  let lastSearchQuery = searchQuery;

  // Reset to first page when search filter changes
  $effect(() => {
    if (searchQuery !== lastSearchQuery) {
      lastSearchQuery = searchQuery;
      page = 1;
    }
  });

  // Clamp current page within valid bounds
  $effect(() => {
    if (page > totalPages) {
      page = totalPages;
    } else if (page < 1) {
      page = 1;
    }
  });

  const displayedData = $derived.by(() => {
    if (sortedData.length === 0) return [];
    const validPage = Math.min(Math.max(1, page), totalPages);
    const start = (validPage - 1) * safePageSize;
    return sortedData.slice(start, start + safePageSize);
  });

  function handleSort(key: string) {
    let nextSort: string | undefined;

    if (sort === key) {
      nextSort = `-${key}`;
    } else if (sort === `-${key}`) {
      nextSort = undefined;
    } else {
      nextSort = key;
    }

    sort = nextSort;
    onSortChange?.(nextSort);
  }

  function sortRows(sortBy: string | undefined, rows: Record<string, unknown>[]) {
    if (!rows || rows.length === 0 || !sortBy) return rows ?? [];

    const descending = sortBy.startsWith('-');
    const key = descending ? sortBy.slice(1) : sortBy;
    const direction = descending ? -1 : 1;

    return [...rows].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      const aMissing = aVal === null || aVal === undefined || aVal === '';
      const bMissing = bVal === null || bVal === undefined || bVal === '';

      // Missing values consistently sink to the bottom regardless of sort direction
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;

      // Numeric comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }

      // Numeric strings comparison
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (
        typeof aVal !== 'boolean' &&
        typeof bVal !== 'boolean' &&
        !Number.isNaN(aNum) &&
        !Number.isNaN(bNum)
      ) {
        return (aNum - bNum) * direction;
      }

      // Dates
      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * direction;
      }

      // Booleans
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        return (aVal === bVal ? 0 : aVal ? 1 : -1) * direction;
      }

      // Natural language string comparison with numeric collation
      return (
        String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: 'base'
        }) * direction
      );
    });
  }

  function filterBySearch(rows: Record<string, unknown>[], query: string) {
    if (!rows || rows.length === 0) return [];
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return rows;

    return rows.filter((row) =>
      safeColumns.some((col) => {
        const val = row[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(trimmed);
      })
    );
  }

  function goToPage(newPage: number) {
    if (newPage < 1 || newPage > totalPages) return;
    page = newPage;
  }

  type PageItem = number | 'ellipsis';

  const paginationItems = $derived.by((): PageItem[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items: PageItem[] = [1];
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);

    if (left > 2) {
      items.push('ellipsis');
    }

    for (let i = left; i <= right; i++) {
      items.push(i);
    }

    if (right < totalPages - 1) {
      items.push('ellipsis');
    }

    items.push(totalPages);
    return items;
  });
</script>

<div class="nui-table-container">
  {#if searchQuery && searchQuery.trim()}
    <div class="nui-table__search" role="status" aria-live="polite">
      Found {filteredData.length} {filteredData.length === 1 ? 'result' : 'results'} for "{searchQuery.trim()}"
    </div>
  {/if}

  <table class="nui-table">
    <thead>
      <tr>
        {#each safeColumns as col (col.key)}
          {@const isSortedAsc = sort === col.key}
          {@const isSortedDesc = sort === `-${col.key}`}
          {@const ariaSortValue = col.sortable
            ? (isSortedAsc ? 'ascending' : isSortedDesc ? 'descending' : 'none')
            : undefined}
          <th
            class="nui-table__th"
            class:nui-table__th--sortable={col.sortable}
            aria-sort={ariaSortValue}
            style="text-align: {col.align ?? 'left'}"
          >
            {#if col.sortable}
              <button
                type="button"
                class="nui-table__sort-btn"
                onclick={() => handleSort(col.key)}
                aria-label={`Sort by ${col.header}`}
              >
                <span>{col.header}</span>
                <span class="nui-table__sort-icon" aria-hidden="true">
                  {#if isSortedAsc}
                    ▲
                  {:else if isSortedDesc}
                    ▼
                  {:else}
                    ↕
                  {/if}
                </span>
              </button>
            {:else}
              <span>{col.header}</span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each displayedData as row, rowIndex ((row as Record<string, unknown>).id ?? (row as Record<string, unknown>).key ?? rowIndex)}
        <tr>
          {#each safeColumns as col (col.key)}
            <td class="nui-table__td" style="text-align: {col.align ?? 'left'}">
              {#if col.cell}
                {@render col.cell({ row, value: row[col.key], index: rowIndex })}
              {:else if col.format}
                {col.format(row[col.key], row)}
              {:else if col.render}
                {col.render(row)}
              {:else}
                {row[col.key] ?? ''}
              {/if}
            </td>
          {/each}
        </tr>
      {:else}
        <tr>
          <td
            class="nui-table__td nui-table__empty"
            colspan={safeColumns.length || 1}
            role="status"
            aria-live="polite"
          >
            {emptyText}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if pagination && totalPages > 1}
    <nav class="nui-table__pagination" aria-label="Pagination">
      <button
        type="button"
        class="nui-table__page-btn"
        disabled={page === 1}
        aria-label="Previous page"
        onclick={() => goToPage(page - 1)}
      >
        ‹
      </button>

      {#each paginationItems as item, idx (`${item}-${idx}`)}
        {#if item === 'ellipsis'}
          <span class="nui-table__ellipsis" aria-hidden="true">…</span>
        {:else}
          <button
            type="button"
            class="nui-table__page-btn"
            class:nui-table__page-btn--active={page === item}
            aria-current={page === item ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onclick={() => goToPage(item)}
          >
            {item}
          </button>
        {/if}
      {/each}

      <button
        type="button"
        class="nui-table__page-btn"
        disabled={page === totalPages}
        aria-label="Next page"
        onclick={() => goToPage(page + 1)}
      >
        ›
      </button>
    </nav>
  {/if}
</div>

<style>
  .nui-table-container {
    width: 100%;
    overflow-x: auto;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-table__search {
    padding: 0.5rem;
    font-size: 0.875rem;
    color: var(--nui-fg-secondary, #8b8b99);
    margin-bottom: 0.5rem;
  }

  .nui-table {
    width: 100%;
    border-collapse: collapse;
    color: var(--nui-fg, #fafafa);
    font-size: 0.875rem;
  }

  .nui-table__th,
  .nui-table__td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--nui-border, #27272a);
    box-sizing: border-box;
  }

  .nui-table__th {
    background: var(--nui-surface-alt, #101012);
    font-weight: 600;
    color: var(--nui-fg-secondary, #8b8b99);
    position: sticky;
    top: 0;
    user-select: none;
  }

  .nui-table__sort-btn {
    background: transparent;
    border: none;
    padding: 0;
    font: inherit;
    color: inherit;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    cursor: pointer;
    text-align: inherit;
    width: 100%;
    border-radius: var(--nui-radius, 0.25rem);
    transition: color 0.15s ease;
  }

  .nui-table__sort-btn:hover {
    color: var(--nui-fg, #fafafa);
  }

  .nui-table__sort-btn:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-table__sort-icon {
    font-size: 0.75rem;
    opacity: 0.6;
    user-select: none;
  }

  .nui-table__empty {
    text-align: center;
    padding: 2.5rem 1rem;
    color: var(--nui-fg-secondary, #8b8b99);
  }

  .nui-table__pagination {
    display: flex;
    gap: 0.35rem;
    justify-content: center;
    align-items: center;
    padding: 0.75rem;
    margin-top: 0.5rem;
  }

  .nui-table__page-btn {
    background: transparent;
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.25rem);
    padding: 0.25rem 0.65rem;
    font: inherit;
    font-size: 0.8125rem;
    color: inherit;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .nui-table__page-btn:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
    border-color: var(--nui-border-hover, #52525b);
  }

  .nui-table__page-btn:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 1px;
  }

  .nui-table__page-btn:disabled:not(.nui-table__page-btn--active) {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .nui-table__page-btn--active {
    background: var(--nui-primary, #3b82f6);
    border-color: var(--nui-primary, #3b82f6);
    color: #fff;
    cursor: default;
  }

  .nui-table__ellipsis {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
    color: var(--nui-fg-secondary, #8b8b99);
    user-select: none;
  }
</style>
