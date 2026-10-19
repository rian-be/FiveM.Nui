# @fivem-nui/svelte

> Svelte adapter and reactive toolkit for FiveM NUI communication, engineered for **Svelte 5** Runes (`$state`, `$derived`, `$effect`).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/rian-be/FiveM.Nui/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12.0-brightgreen.svg)](#requirements)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue.svg)](#requirements)
[![Svelte](https://img.shields.io/badge/Svelte-5.x-orange.svg)](https://svelte.dev)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

`@fivem-nui/svelte` provides seamless, reactive integration between client C# scripts (.NET 10) and Svelte 5 NUI panels. It wraps `@fivem-nui/core` with native Svelte 5 Runes, DOM actions (`use:action`), keyboard shortcuts, focus trapping, and browser mocking for rapid local development.

---

## Installation

```bash
npm install @fivem-nui/svelte @fivem-nui/core svelte
```

> **Note:** `@fivem-nui/core` (`>=1.0.0`) and `svelte` (`>=5.0.0`) are peer dependencies.

---

## Package Entry Points

The package exposes modular subpaths for tree-shaking and isolation:

| Import Path | Description | Contents |
|---|---|---|
| `@fivem-nui/svelte` | Main library | Runes (`useNuiState`, `useNuiQuery`, `useNuiWindow`), client, context, error re-exports |
| `@fivem-nui/svelte/actions` | DOM actions | `nuiEscapeAction`, `nuiFocusTrap`, `nuiClickOutside`, `nuiLayer` |
| `@fivem-nui/svelte/mock` | Browser mocking | `setupNuiMock`, mock transport and window emission helpers |

```ts
import { nui, useNuiState, useNuiQuery } from '@fivem-nui/svelte';
import { nuiFocusTrap, nuiClickOutside } from '@fivem-nui/svelte/actions';
import { setupNuiMock } from '@fivem-nui/svelte/mock';
```

---

## Runes API

### 1. `useNuiState` (Reactive C# → UI Events)

Synchronizes incoming NUI events with a reactive `$state` rune, supporting functional updates:

```svelte
<script lang="ts">
  import { useNuiState } from '@fivem-nui/svelte';

  interface PlayerStats {
    health: number;
    armor: number;
  }

  // Automatically listens to 'player:stats' and unregisters on component unmount
  const stats = useNuiState<PlayerStats>('player:stats', { health: 100, armor: 0 });

  function heal(amount: number) {
    stats.update(prev => ({ ...prev, health: Math.min(100, prev.health + amount) }));
  }
</script>

<div class="hud">
  <p>Health: {stats.value.health}%</p>
  <p>Armor: {stats.value.armor}%</p>
  {#if stats.updatedAt}
    <small>Last updated: {new Date(stats.updatedAt).toLocaleTimeString()}</small>
  {/if}
</div>
```

---

### 2. `useNuiQuery` (Reactive UI → C# Request/Response)

Manages outgoing `nui.request` calls with automated reactive states (`loading`, `error`, `data`), retries, and cancellation:

```svelte
<script lang="ts">
  import { useNuiQuery } from '@fivem-nui/svelte';

  interface BuyRequest { itemId: string; quantity: number; }
  interface BuyResponse { success: boolean; balance: number; }

  const buy = useNuiQuery<BuyRequest, BuyResponse>('shop:buy');
</script>

<button 
  onclick={() => buy.execute({ itemId: 'water', quantity: 2 })} 
  disabled={buy.loading}
>
  {buy.loading ? 'Purchasing...' : 'Buy Water'}
</button>

<button onclick={() => buy.refetch()} disabled={!buy.called || buy.loading}>
  Repeat Purchase
</button>

{#if buy.error}
  <p class="error">{buy.error.message}</p>
{/if}

{#if buy.data}
  <p>Remaining Balance: ${buy.data.balance}</p>
{/if}
```

---

### 3. `useNuiWindow` (Window Visibility & Lifecycle)

Synchronizes window visibility with `onWindow` events emitted from C# (`open`, `close`, `focus`, `unfocus`) and handles the `Escape` key by default:

```svelte
<script lang="ts">
  import { useNuiWindow } from '@fivem-nui/svelte';

  // closeOnEscape is enabled by default (true)
  const panel = useNuiWindow('inventory', {
    onClose: () => console.log('Window closed')
  });
</script>

{#if panel.visible}
  <div class="panel">
    <h2>Inventory</h2>
    <button onclick={() => panel.close()}>Close (or press ESC)</button>
  </div>
{/if}
```

---

## UI Utilities, Keyboard & Svelte Actions

The package provides two integration paths: **Svelte Actions (`use:action`)** for declarative DOM binding and **Runes Composables** for programmatic control in `<script>`:

| Feature | Svelte Action (`use:action`) | Runes Composable | Use Case |
|---|---|---|---|
| **Escape Key** | `nuiEscapeAction` | `useEscape()` / `useNuiEscape()` | Close modals or panels on ESC |
| **Focus Trap** | `nuiFocusTrap` | `useFocusTrap()` | Prevent keyboard Tab key from escaping modal |
| **Click Outside** | `nuiClickOutside` | `useClickOutside()` | Dismiss dropdowns and context menus |
| **Layer Stack (Z-Index)** | `nuiLayer` | `useLayer()` | Manage stacking order of nested modals |
| **Keyboard Shortcuts** | — | `useNuiKey()` | Listen for custom hotkeys (e.g., F1, Enter) |

### 1. Keyboard Shortcuts (`useNuiEscape` & `useNuiKey`)

```svelte
<script lang="ts">
  import { useNuiEscape, useNuiKey, nui } from '@fivem-nui/svelte';

  // Cleaned up automatically on component unmount
  useNuiEscape(() => nui.notify('close'));

  // Listen to arbitrary keys with optional condition:
  useNuiKey('F1', () => console.log('Help toggled'), { enabled: () => true });
</script>
```

Or declaratively in template:
```svelte
<div use:nuiEscapeAction={() => panel.close()}>...</div>
```

### 2. Focus Trap (`nuiFocusTrap` / `useFocusTrap`)

Keeps keyboard Tab focus trapped inside the active dialog:

```svelte
<script lang="ts">
  import { nuiFocusTrap } from '@fivem-nui/svelte/actions';
</script>

<div class="modal-dialog" use:nuiFocusTrap>
  <input type="text" placeholder="Character Name..." />
  <button>Save</button>
</div>
```

### 3. Click Outside (`nuiClickOutside` / `useClickOutside`)

Automatically closes popups or dropdowns when clicking outside their element:

```svelte
<script lang="ts">
  import { nuiClickOutside } from '@fivem-nui/svelte/actions';

  let open = $state(true);
</script>

{#if open}
  <div class="dropdown" use:nuiClickOutside={() => (open = false)}>
    Menu Content...
  </div>
{/if}
```

---

## Environment Detection

Detect whether the UI is running inside GTA V / FiveM CEF or in a standard browser:

```typescript
import { isNui, isBrowser, getResourceName } from '@fivem-nui/svelte';

if (isBrowser()) {
  console.log('Running locally in browser (outside FiveM CEF)');
}

console.log('Resource Name:', getResourceName());
```

---

## Browser Mocking (`setupNuiMock`)

Test and style your UI panels in Google Chrome (`npm run dev`) with instant Vite HMR without launching FiveM:

```typescript
import { isBrowser, setupNuiMock } from '@fivem-nui/svelte/mock';

if (isBrowser()) {
  setupNuiMock({
    requests: {
      'shop:buy': async (payload) => {
        return { success: true, balance: 4500, bought: payload.itemId };
      }
    },
    callbacks: {
      'close': () => console.log('Panel closed by UI'),
      'ready': () => console.log('Panel ready acknowledged')
    },
    onSend: {
      'comps:log': (toast) => console.log('Toast sent from UI:', toast)
    }
  });

  // You can also simulate incoming C# traffic from browser DevTools:
  // window.__nuiMock.emitEvent('player:stats', { health: 80, armor: 50 });
  // window.__nuiMock.emitWindow('open', 'inventory');
}
```

---

## Svelte Context & Custom Clients

When you need an isolated NUI client passed down the component hierarchy:

```svelte
<script lang="ts">
  import { setNuiClient, SvelteNuiClient } from '@fivem-nui/svelte';

  const customClient = new SvelteNuiClient({ resource: 'my_resource' });
  setNuiClient(customClient);
</script>
```

In any descendant component:
```svelte
<script lang="ts">
  import { useNuiClient } from '@fivem-nui/svelte';

  const client = useNuiClient();
</script>
```

---

## Re-exports & Error Handling

`@fivem-nui/svelte` directly re-exports the entire `@fivem-nui/error` toolkit and core contract types:

- **Error handling:** `installGlobalErrorHandlers`, `withRetry`, `globalErrorHandler`, `NuiErrorCategory`, `NuiErrorSeverity`, `captureRenderError`, `isAbortError`.
- **Core contracts:** `NuiEventMap`, `NuiEventKey`, `NuiEventRequest`, `NuiEventResponse`, `NuiMessage`, `NuiError`.

---

## License

[MIT](../../../LICENSE) © 2026 Rian.be
