---
description: "Documentation for Svelte 5 composables in @fivem-nui/svelte-components: CEF keyboard shortcuts and form validation."
icon: terminal
---

# UI Composables & Helpers

> **Specialized Svelte 5 composables tailored to FiveM NUI: CEF-safe keyboard hotkeys and automated form validation.**

---

## 1. Keyboard Shortcuts (`useKeyboardShortcut`)

Inside FiveM CEF (Chromium Embedded Framework), global keydown listeners will trigger even when players are actively typing character names, chat messages, or search terms into `<input>` or `<textarea>` elements.

The `useKeyboardShortcut` composable solves this by **intelligently ignoring trigger events** when typing inside interactive form fields or contenteditable elements.

### Basic Usage

```svelte
<script lang="ts">
  import { useKeyboardShortcut } from '@fivem-nui/svelte-components';

  let isInventoryOpen = $state(true);

  // Pressing 'Escape' closes the inventory panel:
  useKeyboardShortcut('Escape', () => {
    isInventoryOpen = false;
  });

  // Numeric hotkeys to quick-switch tabs (ignored if typing in chat/inputs):
  useKeyboardShortcut('1', () => switchTab('weapons'));
  useKeyboardShortcut('2', () => switchTab('items'));
  useKeyboardShortcut('3', () => switchTab('documents'));
</script>
```

### Advanced Options (`KeyboardShortcutOptions`)

```ts
export interface KeyboardShortcutOptions {
  /** Whether the shortcut is currently enabled. */
  enabled?: boolean;
  /** Require Ctrl or Cmd key. */
  ctrl?: boolean;
  /** Require Shift key. */
  shift?: boolean;
  /** Require Alt key. */
  alt?: boolean;
  /** Automatically call e.preventDefault(). Defaults to true. */
  preventDefault?: boolean;
  /** Allow shortcut to fire even inside <input> / <textarea>. Defaults to false. */
  allowInInputs?: boolean;
}
```

```svelte
<script lang="ts">
  import { useKeyboardShortcut } from '@fivem-nui/svelte-components';

  // Ctrl + S to save vehicle modifications:
  useKeyboardShortcut('s', () => {
    saveCustomization();
  }, { ctrl: true });
</script>
```

---

## 2. Universal Form Validation (`validateForm` & `validateField`)

A lightweight validation engine used internally by `NuiForm` or available as standalone utilities.

### Validation Rules Schema (`ValidationRules`)

```ts
export interface ValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  validator?: (value: unknown) => string | boolean | Promise<string | boolean>;
  message?: string;
}
```

### Standalone Example

```svelte
<script lang="ts">
  import { validateForm, type ValidationRules } from '@fivem-nui/svelte-components';

  let transferData = $state({
    amount: 0,
    recipientIban: ''
  });

  let validationErrors = $state<Record<string, string>>({});

  const rules: Record<string, ValidationRules> = {
    amount: { 
      required: true, 
      min: 1, 
      max: 100000, 
      message: 'Transfer amount must be between $1 and $100,000' 
    },
    recipientIban: { 
      required: true, 
      pattern: /^LS-\d{6}$/, 
      message: 'Invalid IBAN format (expected LS-XXXXXX)' 
    }
  };

  function handleTransfer() {
    validationErrors = validateForm(transferData, rules);
    if (Object.keys(validationErrors).length > 0) {
      // Form has errors, cancel submit
      return;
    }

    // Submit validated transfer
  }
</script>
```
