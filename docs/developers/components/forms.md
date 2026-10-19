---
description: "Documentation for form controls in @fivem-nui/svelte-components: Form, Input, Select, Checkbox, Radio, Datepicker, and FileInput."
icon: edit
---

# Form Controls

> **Accessible, reactive form components supporting two-way binding (`$bindable`), automated validation, debounced game synchronization, and custom styling.**

---

## 1. `NuiForm`

An accessible form wrapper providing client-side validation, asynchronous submission locking, and optional confirmation prompts before dispatching events to the backend.

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `eventName` | `string` | `undefined` | Main NUI event dispatched on submit. |
| `payload` | `unknown` | `undefined` | Explicit payload sent instead of `values`. |
| `values` | `Record<string, unknown>` | `{}` | Object containing form field states to validate. |
| `rules` | `Record<string, ValidationRules>` | `{}` | Validation schema mapped by field key. |
| `confirm` | `boolean` | `false` | Whether user confirmation is required before submit. |
| `confirmMessage` | `string` | `'Are you sure you want to submit?'` | Confirmation prompt text. |
| `confirmCallback` | `(msg: string) => boolean \| Promise<boolean>` | `undefined` | Custom async confirmation callback (e.g. opens `NuiDialog`). |
| `loading` | `boolean` | `false` | Transport loading state. Supports `bind:loading`. |
| `disabled` | `boolean` | `false` | Disables all inputs and submit buttons. |
| `autoReset` | `boolean` | `false` | Whether to reset error display on success. |
| `onSuccessCallback` | `(payload: unknown) => void` | `undefined` | Callback invoked after successful submission. |
| `onFailureCallback` | `(error: unknown) => void` | `undefined` | Callback invoked on submit error. |

### Example

```svelte
<script lang="ts">
  import { NuiForm, NuiInput, NuiButton } from '@fivem-nui/svelte-components';

  let formValues = $state({
    accountNumber: '',
    amount: 100
  });

  const formRules = {
    accountNumber: { required: true, pattern: /^ACC-\d{4}$/ },
    amount: { required: true, min: 10, max: 50000 }
  };
</script>

<NuiForm
  eventName="bank:transferFunds"
  values={formValues}
  rules={formRules}
  confirm
  confirmMessage="Confirm wire transfer of funds?"
  onSuccessCallback={() => console.log('Transfer complete')}
>
  <NuiInput 
    label="Recipient Account" 
    placeholder="ACC-1234"
    bind:value={formValues.accountNumber} 
  />

  <NuiInput 
    type="number"
    label="Amount ($)" 
    min={10} 
    max={50000}
    bind:value={formValues.amount} 
  />

  <NuiButton type="submit" variant="primary">Send Money</NuiButton>
</NuiForm>
```

---

## 2. `NuiInput`

Single-line text, number, password, search, or multiline `textarea` field with optional game synchronization and debounced change notifications.

### Key Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `value` | `string` | `''` | Current input value. Supports `bind:value`. |
| `type` | `'text' \| 'number' \| 'password' \| 'email' \| 'search' \| 'textarea'` | `'text'` | Input control type. |
| `label` | `string` | `undefined` | Field label displayed above the control. |
| `placeholder` | `string` | `undefined` | Placeholder text. |
| `twoWay` | `boolean` | `false` | When `true`, automatically synchronizes value with authoritative game events. |
| `eventName` | `string` | `undefined` | Event name used for two-way synchronization. |
| `debounce` | `number \| string` | `0` | Debounce delay before dispatching `onValueChange` (e.g. `300` or `'300ms'`). |
| `onValueChange` | `string` | `undefined` | Event sent when value settles after debounce. |
| `min` / `max` / `step` | `number \| string` | `undefined` | Constraints for numeric/range inputs. |
| `minlength` / `maxlength` | `number` | `undefined` | Text character length constraints. |
| `pattern` | `string` | `undefined` | Regular expression pattern for validation. |
| `disabled` / `readonly` | `boolean` | `false` | Input state controls. |

### Example

```svelte
<script lang="ts">
  import { NuiInput } from '@fivem-nui/svelte-components';

  let search = $state('');
  let notes = $state('');
</script>

<!-- Search input with automatic 300ms debounce -->
<NuiInput 
  type="search"
  label="Search Inventory"
  placeholder="Type item name..."
  debounce="300ms"
  onValueChange="inventory:filterItems"
  bind:value={search}
/>

<!-- Multiline textarea -->
<NuiInput 
  type="textarea"
  label="Incident Report Notes"
  placeholder="Describe the situation..."
  maxlength={500}
  bind:value={notes}
/>
```

---

## 3. `NuiSelect`

Custom accessible dropdown menu supporting single-choice or multi-choice (`multiple`), live search filtering (`searchable`), and keyboard navigation.

### Option Type (`NuiSelectOption`)

```ts
export interface NuiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}
```

### Example

```svelte
<script lang="ts">
  import { NuiSelect, type NuiSelectOption } from '@fivem-nui/svelte-components';

  let selectedJob = $state('police');

  const jobOptions: NuiSelectOption[] = [
    { value: 'police', label: 'Police Officer', group: 'Emergency Services' },
    { value: 'ems', label: 'Paramedic / EMS', group: 'Emergency Services' },
    { value: 'mechanic', label: 'LS Customs Mechanic', group: 'Civilian' },
    { value: 'taxi', label: 'Downtown Cab Co.', group: 'Civilian' }
  ];
</script>

<NuiSelect 
  label="Select Department"
  options={jobOptions}
  searchable
  bind:value={selectedJob}
/>
```

---

## 4. `NuiCheckbox` & `NuiRadioGroup`

### `NuiCheckbox`

Toggle control supporting standard checked state and indeterminate state:

```svelte
<script lang="ts">
  import { NuiCheckbox } from '@fivem-nui/svelte-components';

  let showOfflineMembers = $state(true);
</script>

<NuiCheckbox bind:checked={showOfflineMembers}>
  Display offline gang members
</NuiCheckbox>
```

### `NuiRadioGroup`

Radio choice group supporting rich descriptions and disabled choices:

```svelte
<script lang="ts">
  import { NuiRadioGroup, type NuiRadioOption } from '@fivem-nui/svelte-components';

  let selectedTier = $state('vip');

  const tiers: NuiRadioOption[] = [
    { value: 'standard', label: 'Standard Tier', description: 'Base salary and 1 vehicle slot' },
    { value: 'vip', label: 'VIP Tier', description: 'Bonus salary, 5 vehicle slots, priority queue' },
    { value: 'custom', label: 'Custom Organization', description: 'Available for enterprise businesses', disabled: true }
  ];
</script>

<NuiRadioGroup 
  label="Membership Plan" 
  options={tiers} 
  bind:value={selectedTier} 
/>
```

---

## 5. `NuiDatepicker` & `NuiFileInput`

### `NuiDatepicker`

CEF-friendly calendar component for date selection (formatted as `YYYY-MM-DD`):

```svelte
<script lang="ts">
  import { NuiDatepicker } from '@fivem-nui/svelte-components';

  let birthDate = $state('1995-04-12');
</script>

<NuiDatepicker 
  label="Date of Birth"
  min="1920-01-01"
  max="2020-12-31"
  bind:value={birthDate}
/>
```

### `NuiFileInput`

Client-side file picker with validation for file size and supported extensions:

```svelte
<script lang="ts">
  import { NuiFileInput, type FileInfo } from '@fivem-nui/svelte-components';

  let selectedFiles = $state<FileInfo[]>([]);
</script>

<NuiFileInput
  label="Import Layout Preset"
  accept=".json"
  maxSize="2MB"
  maxFiles={1}
  bind:files={selectedFiles}
/>
```
