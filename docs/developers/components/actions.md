---
description: "Documentation and usage guide for NuiButton in @fivem-nui/svelte-components."
icon: mouse-pointer
---

# Actions (`NuiButton`)

> **An accessible, FiveM-integrated button featuring automated NUI messaging, loading spinners, style variants, and reactive pre-conditions.**

The `NuiButton` component goes beyond standard HTML buttons by integrating directly with `@fivem-nui/svelte`. When clicked, it can automatically dispatch NUI events to your C# backend, display a loading spinner while awaiting a response, and handle success/error callbacks.

---

## 1. Quick Example

```svelte
<script lang="ts">
  import { NuiButton } from '@fivem-nui/svelte-components';

  let isSubmitting = $state(false);
  let playerCash = $state(1500);
</script>

<!-- Dispatches a NUI event to C# and displays an inline spinner while loading -->
<NuiButton 
  variant="primary"
  eventName="garage:spawnVehicle"
  payload={{ model: 't20', color: [255, 0, 0] }}
  bind:loading={isSubmitting}
  condition={() => playerCash >= 500}
  onSuccessCallback={(res) => console.log('Spawned successfully', res)}
  onFailure={(err) => console.error('Failed to spawn vehicle', err)}
>
  Spawn T20 ($500)
</NuiButton>
```

---

## 2. Component API

### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'link'` | `'primary'` | Visual style variant. |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Button size padding and typography. |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Native HTML button type. |
| `eventName` | `string` | `undefined` | Event name dispatched to the game when clicked. |
| `payload` | `unknown` | `undefined` | Payload sent along with `eventName`. |
| `loading` | `boolean` | `false` | Whether to display a spinner and prevent interaction. Supports `bind:loading`. |
| `disabled` | `boolean` | `false` | Standard disable state. |
| `condition` | `(() => boolean) \| null` | `null` | Reactive predicate function; button is enabled **only** when returning `true`. |
| `disabledWhen` | `(() => boolean) \| boolean \| null` | `null` | Disables the button when evaluated to `true`. |
| `keepLoadingOnSuccess` | `boolean` | `false` | When `true`, keeps the spinner spinning after success (parent resets via `bind:loading`). |
| `onSuccess` | `string` | `undefined` | Secondary NUI event dispatched to C# upon success. |
| `onError` | `string` | `undefined` | NUI event dispatched to C# if the operation throws an error. |
| `onSuccessCallback` | `(result?: unknown) => void` | `undefined` | Local client-side callback invoked on success. |
| `onFailure` | `(error: unknown) => void` | `undefined` | Local client-side callback invoked on failure. |
| `client` | `SvelteNuiClient` | `undefined` | Custom NUI client instance (defaults to global singleton `nui`). |

---

## 3. Visual Variants & Sizes

### Variants

* **`primary`**: Main call-to-action (accent background, bold text).
* **`secondary`**: Neutral, surface-based button for secondary actions.
* **`danger`**: Destructive actions (e.g. Delete, Impound, Revoke).
* **`link`**: Text-only button without background borders.

```svelte
<NuiButton variant="primary">Confirm</NuiButton>
<NuiButton variant="secondary">Cancel</NuiButton>
<NuiButton variant="danger">Delete Character</NuiButton>
<NuiButton variant="link">Need help?</NuiButton>
```

### Sizes

```svelte
<NuiButton size="xs">Extra Small</NuiButton>
<NuiButton size="sm">Small</NuiButton>
<NuiButton size="md">Medium (Default)</NuiButton>
<NuiButton size="lg">Large</NuiButton>
```

---

## 4. Reactive Pre-Conditions

Rather than calculating complex ternary strings on `disabled`, you can pass a reactive closure to `condition` or `disabledWhen`:

```svelte
<script lang="ts">
  import { NuiButton } from '@fivem-nui/svelte-components';

  let balance = $state(250);
  let hasPendingOrder = $state(false);
</script>

<!-- Only enabled if balance >= 100 AND no pending order is active -->
<NuiButton
  variant="primary"
  eventName="shop:purchase"
  payload={{ itemId: 'medkit' }}
  condition={() => balance >= 100}
  disabledWhen={() => hasPendingOrder}
>
  Purchase Medkit ($100)
</NuiButton>
```

---

## 5. Local Click Actions

If you do not want to trigger an automated NUI post, omit `eventName` and provide a standard `onclick` handler:

```svelte
<script lang="ts">
  import { NuiButton } from '@fivem-nui/svelte-components';

  let isModalOpen = $state(false);
</script>

<NuiButton variant="secondary" onclick={() => isModalOpen = true}>
  Open Settings
</NuiButton>
```
