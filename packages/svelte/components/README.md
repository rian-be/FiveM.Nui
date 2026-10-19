# @fivem-nui/svelte-components

> Modern, reactive UI component library for **FiveM NUI**, built completely with **Svelte 5** (Runes, Snippets, `$bindable`).

Designed for seamless integration with `@fivem-nui/core` and `@fivem-nui/svelte`. Styled using CSS custom properties (`--nui-*`) for effortless theming and custom styling across all in-game panels.

---

## Installation

```bash
npm install @fivem-nui/svelte-components @fivem-nui/svelte @fivem-nui/core
```

Peer Dependencies:
* `svelte`: `^5.20.0`
* `@fivem-nui/core`: `^1.0.0`
* `@fivem-nui/svelte`: `^1.0.0`

---

## Theming System (CSS Variables)

All components read their values from standard CSS variables. You can override them in `:root` or inside any window container:

```css
:root {
  --nui-primary: #3b82f6;
  --nui-primary-hover: #2563eb;
  --nui-surface: #18181b;
  --nui-surface-alt: #101012;
  --nui-border: #27272a;
  --nui-fg: #fafafa;
  --nui-fg-secondary: #8b8b99;
  --nui-radius: 0.375rem;
  --nui-success: #22c55e;
  --nui-warning: #f59e0b;
  --nui-danger: #ef4444;
  --nui-info: #06b6d4;
  --nui-scrim: rgba(0, 0, 0, 0.65);
}
```

---

## Component Overview

> Comprehensive guides, props, events, and code recipes for all components are available in the [UI Components Documentation Portal](../../../docs/developers/components/README.md).

### 1. Actions — [Read Guide](../../../docs/developers/components/actions.md)
* **`NuiButton`** — Button with built-in FiveM NUI event posting (`eventName`, `payload`), `loading` state, spinner, style variants (`primary`, `secondary`, `danger`, `link`), and reactive disable conditions.

### 2. Forms — [Read Guide](../../../docs/developers/components/forms.md)
* **`NuiForm`** — Form container with automated field validation (`validateForm`, `ValidationRules`), submit events, and error handling.
* **`NuiInput`** — Text input (`text`, `number`, `password`, `search`) with two-way `bind:value`, debounce, and icons.
* **`NuiCheckbox`** — FiveM-styled toggle checkbox with `bind:checked` and indeterminate state support.
* **`NuiRadioGroup`** — Radio option group with descriptions and selection states.
* **`NuiSelect`** — Dropdown menu supporting single or multi-select (`multiple`), search filtering (`searchable`), and labels.
* **`NuiDatepicker`** — Interactive calendar with month navigation and `YYYY-MM-DD` formatting.
* **`NuiFileInput`** — File selection control with size validation (`maxSize`), file limits, and previews.

### 3. Layout — [Read Guide](../../../docs/developers/components/layout.md)
* **`NuiCard`** — Card container with title, subtitle, badges, and custom snippet slots (`headerActions`, `footer`).
* **`NuiCardGrid`** — Responsive auto-fit grid for cards (`minCardWidth`, `gap`).
* **`NuiFlex`** — Flexbox layout container (`direction`, `justify`, `align`, `gap`, `wrap`).
* **`NuiGrid`** — CSS Grid layout helper (`columns`, `gap`, `rowGap`, `colGap`).
* **`NuiStack`** — Vertical or horizontal stack with uniform spacing and optional dividers.

### 4. Navigation — [Read Guide](../../../docs/developers/components/navigation.md)
* **`NuiTabs`** — Tab list with keyboard accessibility (arrow navigation, Home/End) and active tab binding.
* **`NuiMenu`** — Floating dropdown / context menu with nested items and shortcuts.
* **`NuiSidebar`** — Collapsible side navigation drawer for administration panels.
* **`NuiBreadcrumbs`** — Breadcrumb navigation trail.
* **`NuiPagination`** — Pagination controls for data grids and lists.
* **`NuiAccordion`** — Collapsible panels for FAQs, rules, or settings.

### 5. Overlays — [Read Guide](../../../docs/developers/components/overlay.md)
* **`NuiModal`** — Accessible dialog with backdrop dimming, focus trapping, Escape key support, and `ModalAction[]`.
* **`NuiDialog`** — Lightweight confirm/alert popups.
* **`NuiTooltip`** — Floating tooltips with custom placement (`top`, `bottom`, `left`, `right`).

### 6. Data Display — [Read Guide](../../../docs/developers/components/data.md)
* **`NuiBadge`** — Status badge (`primary`, `secondary`, `success`, `warning`, `danger`, `info`).
* **`NuiProgressBar`** — Progress bar with striped animation and custom labels.
* **`NuiTable`** — Sortable, paginated data table (`NuiTableColumn<T>[]`).
* **`NuiList`** — Interactive, selectable item list (`NuiListItem[]`).
* **`NuiCodeBlock`** — Formatted code display with copy-to-clipboard button.
* **`NuiRichText`** — Sanitized HTML / text renderer.
* **`NuiChart`** — High-performance canvas chart (`bar`, `line`, `pie`) with `ChartData` and `ChartOptions`.

---

## Composables & Helpers — [Read Guide](../../../docs/developers/components/composables.md)

* **`useKeyboardShortcut`** — Register hotkeys that automatically ignore events when typing in inputs/textareas.
* **`validateForm`** / **`validateField`** — Client side form validation rules.

---

## License

MIT © Rainbe