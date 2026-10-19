---
description: "Documentation for overlay components in @fivem-nui/svelte-components: Modal, Dialog, and Tooltip."
icon: layers
---

# Overlays

> **Accessible modal dialogs, confirmation prompts, and contextual tooltips with built-in CEF focus trapping, scroll locking, and Escape key dismissal.**

---

## 1. `NuiModal`

The core dialog component in the design system. It manages accessible backdrop dimming, keyboard focus trapping, Escape key dismissals, and seamless multi-modal stacking (making background modals inert so keyboard focus never leaks into lower layers).

### Modal Action Type (`ModalAction`)

```ts
export interface ModalAction {
  id?: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  closeOnClick?: boolean;
  onclick?: (event: MouseEvent) => unknown | Promise<unknown>;
}
```

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `open` | `boolean` | `false` | Whether the modal is visible. Supports `bind:open`. |
| `title` | `string` | `undefined` | Header title string. |
| `description` | `string` | `undefined` | Subtitle description string linked via `aria-describedby`. |
| `actions` | `ModalAction[]` | `[]` | Bottom action buttons. |
| `closable` | `boolean` | `true` | Enables standard close button and click-outside dismissal. |
| `closeOnEscape` | `boolean` | `closable` | Whether pressing `Escape` dismisses the modal. |
| `closeOnBackdrop` | `boolean` | `closable` | Whether clicking the darkened background dismisses the modal. |
| `initialFocus` | `string` | `undefined` | Element ID or action ID to receive focus upon opening. |
| `onClose` | `() => void` | `undefined` | Callback fired when the modal closes. |
| `children` | `Snippet` | `undefined` | Modal body content. |

### Example

```svelte
<script lang="ts">
  import { NuiModal, NuiButton, type ModalAction } from '@fivem-nui/svelte-components';

  let isModalOpen = $state(false);

  const modalActions: ModalAction[] = [
    { label: 'Cancel', variant: 'secondary', closeOnClick: true },
    {
      label: 'Confirm Transfer',
      variant: 'primary',
      onclick: async () => {
        // Execute transfer logic
        isModalOpen = false;
      }
    }
  ];
</script>

<NuiButton variant="primary" onclick={() => isModalOpen = true}>
  Transfer Ownership
</NuiButton>

<NuiModal
  title="Transfer Property"
  description="Transferring House #42 to another citizen."
  open={isModalOpen}
  actions={modalActions}
  onClose={() => isModalOpen = false}
>
  <p>Please ensure the buyer has paid the necessary notary taxes before confirming.</p>
</NuiModal>
```

---

## 2. `NuiDialog`

A streamlined prompt/alert wrapper built on top of `NuiModal`. It is ideal for yes/no confirmation prompts and dispatches NUI events directly upon player decision.

### Dialog Action Type (`NuiDialogAction`)

```ts
export interface NuiDialogAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}
```

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `open` | `boolean` | `false` | Visibility state. Supports `bind:open`. |
| `title` | `string` | `undefined` | Dialog heading. |
| `message` | `string` | `undefined` | Text message displayed in dialog body. |
| `actions` | `NuiDialogAction[]` | `[]` | List of choice buttons. |
| `eventName` | `string` | `undefined` | NUI event dispatched to C# when an action is clicked. |
| `cancelEvent` | `string` | `undefined` | NUI event dispatched to C# if dismissed via Escape or backdrop. |
| `onAction` | `(actionId: string \| null) => void` | `undefined` | Local callback returning selected action ID. |

### Example

```svelte
<script lang="ts">
  import { NuiDialog, type NuiDialogAction } from '@fivem-nui/svelte-components';

  let isPromptOpen = $state(false);

  const choices: NuiDialogAction[] = [
    { id: 'cancel', label: 'Keep Vehicle', variant: 'secondary' },
    { id: 'confirm_crush', label: 'Crush Vehicle', variant: 'danger' }
  ];
</script>

<NuiDialog
  title="Scrapyard Confirmation"
  message="Are you sure you want to crush this vehicle? You will receive $1,200 in scrap parts."
  bind:open={isPromptOpen}
  actions={choices}
  eventName="scrapyard:decision"
  onAction={(actionId) => {
    console.log('Player chose:', actionId);
    isPromptOpen = false;
  }}
/>
```

---

## 3. `NuiTooltip`

Contextual hover or focus hint positioned relative to target UI elements.

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `text` | `string` | `undefined` | Tooltip text message. |
| `position` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Preferred tooltip placement. |
| `delay` | `number` | `200` | Hover delay in milliseconds before appearing. |

### Example

```svelte
<script lang="ts">
  import { NuiTooltip, NuiButton } from '@fivem-nui/svelte-components';
</script>

<NuiTooltip text="Equipping heavy body armor reduces sprint speed by 10%" position="top">
  <NuiButton variant="secondary">Equip Kevlar</NuiButton>
</NuiTooltip>
```
