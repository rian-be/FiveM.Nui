---
description: "Building interfaces in Svelte 5: nui singleton, Runes, useNuiState, useNuiQuery, and useNuiWindow."
icon: zap
---

# ⚡ Frontend Svelte 5 (`@fivem-nui/svelte`)

> **Build high-performance FiveM NUI interfaces with native Svelte 5 Runes.**

---

## 1. Global `nui` Client

Import the pre-configured `nui` singleton anywhere in your application:

```ts
import { nui } from '@fivem-nui/svelte';
import type { BuyResponse } from './contracts';

// 1. RPC Request with response (types inferred automatically from contracts.ts)
const response = await nui.request('shop:buy', { itemId: 'repairkit', quantity: 1 });
console.log(response.remainingMoney);

// 2. Fire-and-forget one-way message to C#
nui.send('shop:log', { message: 'Menu opened' });

// 3. Respond to reverse RPC requests from C# (RequestAsync)
nui.callback('dialog:confirm', async (req) => {
  const confirmed = await openConfirmModal(req.title, req.message);
  return { confirmed };
});

// 4. Lifecycle Signals (Bootstrap Handshake)
nui.notify('ready'); // Signals UI readiness -> triggers onReady in C# (useNuiWindow does this automatically)
nui.notify('close'); // Closes window -> triggers onClose in C# (useNuiWindow / ESC does this automatically)
```

---

## 2. Reactive State: `useNuiState<T>`

`useNuiState` listens to `Publish` and `SendAsync` events from C# and updates the reactive `.value` property instantly:

```svelte
<script lang="ts">
  import { useNuiState } from '@fivem-nui/svelte';
  import type { CatalogDto } from './contracts';

  const catalog = useNuiState<CatalogDto>('shop:catalog', {
    playerName: 'Loading...',
    playerMoney: 0,
    items: []
  });
</script>

<div class="header">
  <h2>Welcome, {catalog.value.playerName}!</h2>
  <span>Bank Balance: ${catalog.value.playerMoney}</span>
</div>
```

---

## 3. Asynchronous Queries: `useNuiQuery`

Instead of manually toggling loading flags and disabling buttons, `useNuiQuery` manages async request lifecycles:

```svelte
<script lang="ts">
  import { useNuiQuery } from '@fivem-nui/svelte';
  import type { BuyRequest, BuyResponse } from './contracts';

  const buyQuery = useNuiQuery<BuyRequest, BuyResponse>('shop:buy');

  async function handleBuy(itemId: string) {
    await buyQuery.execute({ itemId, quantity: 1 });
  }
</script>

<button onclick={() => handleBuy('bread')} disabled={buyQuery.loading}>
  {buyQuery.loading ? 'Purchasing...' : 'Buy Bread'}
</button>

{#if buyQuery.error}
  <div class="error-alert">{buyQuery.error.message}</div>
{/if}
```

---

## 4. Window Lifecycle & Escape Key: `useNuiWindow`

The `useNuiWindow` composable bridges component visibility with C# window focus:

```svelte
<script lang="ts">
  import { useNuiWindow } from '@fivem-nui/svelte';

  // Synchronizes with C# show/hide events and ESC keypresses
  const windowState = useNuiWindow('my-resource', {
    closeOnEscape: true,
    onClose: () => {
      console.log('Window closed');
    }
  });
</script>

{#if windowState.visible}
  <main class="panel-container">
    <h1>Shop Menu</h1>
    <button onclick={() => windowState.close()}>Close (ESC)</button>
  </main>
{/if}
```
* **Escape Key Dismissal**: Pressing ESC automatically closes the window and informs C# to release game input focus (`SetNuiFocus(false, false)`).
