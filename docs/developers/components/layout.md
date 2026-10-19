---
description: "Documentation for layout containers in @fivem-nui/svelte-components: Card, CardGrid, Flex, Grid, and Stack."
icon: grid
---

# Layout Containers

> **Flexible, responsive layout containers designed to structure in-game menus, inventory screens, shop catalogs, and stats dashboards.**

---

## 1. `NuiCard` & `NuiCardGrid`

### `NuiCard`

A surface container featuring structured header, body, and footer areas using Svelte 5 snippets.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | `undefined` | Card header title text. |
| `subtitle` | `string` | `undefined` | Secondary header text displayed below the title. |
| `bordered` | `boolean` | `true` | Whether to draw standard border outline. |
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Internal card body padding. |
| `headerActions` | `Snippet` | `undefined` | Snippet rendered in the top-right corner of the header. |
| `footer` | `Snippet` | `undefined` | Snippet rendered at the bottom of the card. |
| `children` | `Snippet` | `undefined` | Main card content body. |

### `NuiCardGrid`

An auto-fitting responsive grid designed specifically for catalog views (e.g. car dealerships, inventory items, houses for sale):

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `minCardWidth` | `string` | `'280px'` | Minimum column width before wrapping to the next line. |
| `gap` | `string` | `'1rem'` | CSS gap between card items. |

### Example

```svelte
<script lang="ts">
  import { NuiCard, NuiCardGrid, NuiBadge, NuiButton } from '@fivem-nui/svelte-components';

  const inventoryItems = [
    { id: 1, name: 'First Aid Kit', quantity: 3, weight: '0.5kg', rarity: 'common' },
    { id: 2, name: 'Heavy Armor Vest', quantity: 1, weight: '3.0kg', rarity: 'rare' },
    { id: 3, name: 'Lockpick Set', quantity: 5, weight: '0.2kg', rarity: 'uncommon' }
  ];
</script>

<NuiCardGrid minCardWidth="240px" gap="1rem">
  {#each inventoryItems as item (item.id)}
    <NuiCard title={item.name} subtitle={`Weight: ${item.weight}`}>
      {#snippet headerActions()}
        <NuiBadge variant={item.rarity === 'rare' ? 'primary' : 'secondary'}>
          x{item.quantity}
        </NuiBadge>
      {/snippet}

      <p class="description">Standard issue survival gear.</p>

      {#snippet footer()}
        <NuiButton 
          size="sm" 
          variant="secondary"
          eventName="inventory:useItem"
          payload={{ itemId: item.id }}
        >
          Use Item
        </NuiButton>
      {/snippet}
    </NuiCard>
  {/each}
</NuiCardGrid>
```

---

## 2. `NuiFlex`

A wrapper around CSS Flexbox providing type-safe properties for alignment, justification, wrapping, and spacing.

### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `direction` | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | `'row'` | Flex direction. |
| `justify` | `'start' \| 'center' \| 'end' \| 'between' \| 'around' \| 'evenly'` | `'start'` | Justify-content alignment. |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch' \| 'baseline'` | `'start'` | Align-items alignment. |
| `wrap` | `boolean` | `false` | Whether items should wrap to multiple lines. |
| `gap` | `string` | `'0.5rem'` | Spacing between children. |

### Example

```svelte
<script lang="ts">
  import { NuiFlex, NuiBadge, NuiButton } from '@fivem-nui/svelte-components';
</script>

<NuiFlex justify="between" align="center" gap="1rem">
  <div>
    <h3>Pillbox Medical Center</h3>
    <NuiBadge variant="success">Online Staff: 4</NuiBadge>
  </div>

  <NuiButton variant="primary" size="sm">Request Medic</NuiButton>
</NuiFlex>
```

---

## 3. `NuiGrid`

CSS Grid helper for multi-column dashboard layouts.

### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `columns` | `number \| string` | `12` | Number of columns (e.g. `12` or `'1fr 2fr 1fr'`). |
| `gap` | `string` | `'1rem'` | Uniform gap between cells. |
| `rowGap` | `string` | `undefined` | Specific row spacing. |
| `colGap` | `string` | `undefined` | Specific column spacing. |

### Example

```svelte
<script lang="ts">
  import { NuiGrid, NuiCard } from '@fivem-nui/svelte-components';
</script>

<NuiGrid columns="2fr 1fr" gap="1.5rem">
  <NuiCard title="Active Incidents">
    <!-- Main content list -->
  </NuiCard>

  <NuiCard title="Dispatch Summary">
    <!-- Secondary widget -->
  </NuiCard>
</NuiGrid>
```

---

## 4. `NuiStack`

Vertical or horizontal list container enforcing uniform spacing with optional dividers between items.

### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `direction` | `'vertical' \| 'horizontal'` | `'vertical'` | Stack orientation. |
| `spacing` | `string` | `'0.75rem'` | Spacing between stacked items. |
| `divider` | `boolean` | `false` | When `true`, renders a subtle divider line between children. |

### Example

```svelte
<script lang="ts">
  import { NuiStack, NuiInput, NuiButton } from '@fivem-nui/svelte-components';
</script>

<NuiStack spacing="1rem" divider>
  <NuiInput label="Radio Frequency (MHz)" placeholder="99.5" />
  <NuiInput label="Callsign" placeholder="1-ADAM-12" />
  <NuiButton variant="primary">Connect Radio</NuiButton>
</NuiStack>
```
