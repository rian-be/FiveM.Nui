---
description: "Documentation for data display components in @fivem-nui/svelte-components: Table, Chart, Badge, ProgressBar, List, CodeBlock, and RichText."
icon: table
---

# Data Display

> **Components designed for presenting complex game data: player status badges, progress bars, sortable tables, and canvas charts.**

---

## 1. `NuiTable`

An accessible, high-performance data table supporting interactive sorting, text query filtering, windowed pagination, and custom Svelte 5 cell snippets.

### Column Definition (`NuiTableColumn<T>`)

```ts
export interface Column<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  cell?: Snippet<[{ row: T; value: unknown; index: number }]>;
  format?: (value: unknown, row: T) => string | number;
}
```

### Table Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `columns` | `Column<T>[]` | `[]` | List of column definitions. |
| `data` | `T[]` | `[]` | Source data row objects. |
| `sort` | `string` | `undefined` | Active sort key (`'key'` or `'-key'`). Supports `bind:sort`. |
| `pageSize` | `number` | `10` | Rows per page. |
| `page` | `number` | `1` | Active page index. Supports `bind:page`. |
| `searchQuery` | `string` | `''` | Filter rows across all columns by text query. |
| `pagination` | `boolean` | `true` | Whether to render bottom pagination controls. |
| `emptyText` | `string` | `'No data available'` | Message rendered when no rows match. |

### Example

```svelte
<script lang="ts">
  import { NuiTable, NuiBadge, type NuiTableColumn } from '@fivem-nui/svelte-components';

  interface CitizenRecord {
    citizenId: string;
    fullName: string;
    wantedLevel: number;
    phone: string;
  }

  const columns: NuiTableColumn<CitizenRecord>[] = [
    { key: 'citizenId', header: 'Citizen ID', sortable: true, width: '120px' },
    { key: 'fullName', header: 'Name', sortable: true },
    { key: 'phone', header: 'Phone Number' },
    { 
      key: 'wantedLevel', 
      header: 'Status', 
      sortable: true,
      align: 'center'
    }
  ];

  const data: CitizenRecord[] = [
    { citizenId: 'LS-901', fullName: 'Arthur Morgan', wantedLevel: 0, phone: '555-0192' },
    { citizenId: 'LS-902', fullName: 'John Marston', wantedLevel: 3, phone: '555-0481' },
    { citizenId: 'LS-903', fullName: 'Sadie Adler', wantedLevel: 0, phone: '555-0773' }
  ];

  let search = $state('');
</script>

<input type="text" placeholder="Filter citizens..." bind:value={search} />

<NuiTable {columns} {data} searchQuery={search} pageSize={5}>
  <!-- Custom cell snippet for wanted level badge -->
  {#snippet cell({ row, value })}
    {#if row.wantedLevel > 0}
      <NuiBadge variant="danger">{row.wantedLevel} Stars</NuiBadge>
    {:else}
      <NuiBadge variant="success">Clear</NuiBadge>
    {/if}
  {/snippet}
</NuiTable>
```

---

## 2. `NuiChart`

Hardware-accelerated HTML5 Canvas chart supporting `bar`, `line`, `pie`, and `doughnut` visualizations. Ideal for server economy statistics, police crime metrics, or faction balance charts.

### Key Types

```ts
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut';

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}
```

### Chart Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `ChartType` | (required) | Chart rendering strategy (`'line'`, `'bar'`, `'pie'`). |
| `data` | `ChartData` | (required) | Labels and dataset arrays. |
| `width` | `string \| number` | `'100%'` | Chart container width. |
| `height` | `string \| number` | `'300px'` | Canvas height. |
| `options` | `ChartOptions` | `{}` | Grid, legend, and tooltip configuration. |

### Example

```svelte
<script lang="ts">
  import { NuiChart, type ChartData } from '@fivem-nui/svelte-components';

  const crimeTrends: ChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Bank Robberies',
        data: [12, 19, 8, 15, 24, 18],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.2)'
      },
      {
        label: 'Store Heists',
        data: [35, 42, 28, 48, 55, 60],
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.2)'
      }
    ]
  };
</script>

<NuiChart type="line" data={crimeTrends} height="280px" />
```

---

## 3. `NuiBadge` & `NuiProgressBar`

### `NuiBadge`

Small status pill indicator:

```svelte
<script lang="ts">
  import { NuiBadge } from '@fivem-nui/svelte-components';
</script>

<NuiBadge variant="primary">Admin</NuiBadge>
<NuiBadge variant="success">Online</NuiBadge>
<NuiBadge variant="warning">On Duty</NuiBadge>
<NuiBadge variant="danger">Banned</NuiBadge>
<NuiBadge variant="info">VIP</NuiBadge>
```

### `NuiProgressBar`

Animated progress indicator with optional labels and variant accents:

```svelte
<script lang="ts">
  import { NuiProgressBar } from '@fivem-nui/svelte-components';

  let health = $state(85);
  let stamina = $state(60);
</script>

<NuiProgressBar value={health} max={100} variant="danger" showLabel label="Health" />
<NuiProgressBar value={stamina} max={100} variant="primary" showLabel label="Stamina" />
```

---

## 4. `NuiList`, `NuiCodeBlock` & `NuiRichText`

* **`NuiList`**: Interactive item list with selectable states (`NuiListItem[]`).
* **`NuiCodeBlock`**: Displays formatted code or payload snippets with a one-click copy button.
* **`NuiRichText`**: Safe markdown/HTML renderer for server announcements or changelogs.
