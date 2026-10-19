---
description: "Documentation for navigation components in @fivem-nui/svelte-components: Tabs, Sidebar, Accordion, Menu, Breadcrumbs, and Pagination."
icon: compass
---

# Navigation

> **Accessible navigation components allowing players to switch tabs, explore sidebars, and expand accordions smoothly inside full-screen CEF menus.**

---

## 1. `NuiTabs`

Tab container with built-in ARIA roles (`tablist`, `tab`, `tabpanel`) and keyboard navigation (Left/Right arrows, Home, End).

### Tab Type (`Tab`)

```ts
export interface Tab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  badge?: string | number;
}
```

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `tabs` | `Tab[]` | `[]` | Array of tab descriptor objects. |
| `activeTab` | `string` | `undefined` | Active tab identifier. Supports `bind:activeTab`. |
| `variant` | `'underline' \| 'pills' \| 'enclosed'` | `'underline'` | Visual tab styling. |
| `onChange` | `(tabId: string) => void` | `undefined` | Callback fired when the active tab changes. |

### Example

```svelte
<script lang="ts">
  import { NuiTabs, type Tab } from '@fivem-nui/svelte-components';

  let currentTab = $state('vehicles');

  const tabs: Tab[] = [
    { id: 'vehicles', label: 'Garage Vehicles', badge: 4 },
    { id: 'impound', label: 'Impound Lot', badge: 1 },
    { id: 'history', label: 'Insurance History' }
  ];
</script>

<NuiTabs {tabs} bind:activeTab={currentTab} variant="pills">
  {#if currentTab === 'vehicles'}
    <div>Available vehicles list...</div>
  {:else if currentTab === 'impound'}
    <div>Impounded vehicles list...</div>
  {:else if currentTab === 'history'}
    <div>Insurance logs...</div>
  {/if}
</NuiTabs>
```

---

## 2. `NuiSidebar`

A collapsible administrative sidebar drawer featuring dedicated snippets for branding, menu items, and footer profile details.

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `open` | `boolean` | `true` | Whether the sidebar is expanded. Supports `bind:open`. |
| `collapsible` | `boolean` | `false` | Whether to display the toggle expand/collapse button. |
| `width` | `string \| number` | `'250px'` | Expanded sidebar width. |
| `onToggle` | `(open: boolean) => void` | `undefined` | Callback fired when collapsed state changes. |
| `brand` | `Snippet` | `undefined` | Top header brand snippet (logo, server name). |
| `children` | `Snippet` | `undefined` | Main navigation links list. |
| `footer` | `Snippet` | `undefined` | Bottom footer snippet (user badge, logout button). |

### Example

```svelte
<script lang="ts">
  import { NuiSidebar, NuiButton } from '@fivem-nui/svelte-components';

  let isExpanded = $state(true);
</script>

<NuiSidebar bind:open={isExpanded} collapsible width="280px">
  {#snippet brand()}
    <div class="logo">
      <h3>Los Santos Police Dept</h3>
      <span>MDT Terminal v2.4</span>
    </div>
  {/snippet}

  <nav class="nav-links">
    <a href="#dashboard">Dashboard</a>
    <a href="#citizens">Citizen Database</a>
    <a href="#warrants">Active Warrants</a>
    <a href="#reports">Incident Reports</a>
  </nav>

  {#snippet footer()}
    <div class="user-badge">
      <span>Officer: J. Miller (#402)</span>
      <NuiButton size="xs" variant="secondary">Log Off</NuiButton>
    </div>
  {/snippet}
</NuiSidebar>
```

---

## 3. `NuiAccordion`

Expandable panels for collapsible FAQ lists, server rules, or nested settings categories.

### Item Type (`AccordionItem`)

```ts
export interface AccordionItem {
  id: string;
  title: string;
  content?: string;
  disabled?: boolean;
}
```

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `items` | `AccordionItem[]` | `[]` | List of accordion items. |
| `multiple` | `boolean` | `false` | When `true`, allows multiple panels to be open simultaneously. |
| `activeIds` | `string[]` | `[]` | List of currently expanded item IDs. Supports `bind:activeIds`. |

### Example

```svelte
<script lang="ts">
  import { NuiAccordion, type AccordionItem } from '@fivem-nui/svelte-components';

  const serverRules: AccordionItem[] = [
    { id: 'vdm', title: 'Rule 1: Vehicle Deathmatch (VDM)', content: 'Running players over with vehicles without RP reason is prohibited.' },
    { id: 'rdm', title: 'Rule 2: Random Deathmatch (RDM)', content: 'Attacking other players without initiation is strictly disallowed.' },
    { id: 'nlr', title: 'Rule 3: New Life Rule (NLR)', content: 'Upon being revived at the hospital, you forget the prior incident.' }
  ];
</script>

<NuiAccordion items={serverRules} multiple />
```

---

## 4. `NuiMenu` & `NuiBreadcrumbs`

* **`NuiMenu`**: Floating dropdown or context menu supporting keyboard focus and icons.
* **`NuiBreadcrumbs`**: Trail showing the current location inside deep administrative views (e.g. `Home > Police > Cadets > Miller`).

---

## 5. `NuiPagination`

Pagination bar supporting page numbers, next/previous buttons, and page size selection:

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `number` | `1` | Current active page (1-based). Supports `bind:page`. |
| `pageSize` | `number` | `10` | Number of items per page. |
| `total` | `number` | `0` | Total number of items across all pages. |
| `onPageChange` | `(newPage: number) => void` | `undefined` | Callback fired when switching pages. |

### Example

```svelte
<script lang="ts">
  import { NuiPagination } from '@fivem-nui/svelte-components';

  let currentPage = $state(1);
  let totalRecords = $state(145);
</script>

<NuiPagination 
  bind:page={currentPage} 
  pageSize={10} 
  total={totalRecords} 
  onPageChange={(p) => console.log('Page switched to:', p)}
/>
```
