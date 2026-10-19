---
description: "Overview of accessible, themeable Svelte 5 UI components from @fivem-nui/svelte-components."
icon: puzzle-piece
---

# UI Components Overview (`@fivem-nui/svelte-components`)

> **Over 20 pre-built, accessible, and themeable UI components tailored specifically for FiveM CEF, built from the ground up on Svelte 5 (Runes, Snippets, `$bindable`).**

The `@fivem-nui/svelte-components` package provides a production-ready design system designed for in-game dashboards, inventory grids, police MDT terminals, and administration panels. It works seamlessly alongside `@fivem-nui/core` and `@fivem-nui/svelte`.

---

## 🚀 Installation & Requirements

Install the package alongside its peer dependencies:

```bash
npm install @fivem-nui/svelte-components @fivem-nui/svelte @fivem-nui/core
```

### Peer Dependencies
* `svelte`: `>=5.20.0`
* `@fivem-nui/core`: `>=1.0.0`
* `@fivem-nui/svelte`: `>=1.0.0`

---

## 🎨 Design Tokens & Theming (CSS Variables)

All components read their styles from standard CSS variables prefixed with `--nui-*`. You can override them globally in `:root` or locally inside any window or modal container:

```css
:root {
  /* Brand and Surfaces */
  --nui-primary: #3b82f6;
  --nui-primary-hover: #2563eb;
  --nui-surface: #18181b;
  --nui-surface-alt: #101012;
  --nui-border: #27272a;
  --nui-fg: #fafafa;
  --nui-fg-secondary: #8b8b99;
  --nui-radius: 0.375rem;

  /* Status Accents */
  --nui-success: #22c55e;
  --nui-warning: #f59e0b;
  --nui-danger: #ef4444;
  --nui-info: #06b6d4;

  /* Overlays */
  --nui-scrim: rgba(0, 0, 0, 0.65);
}
```

---

## 📚 Component Modules

The components are grouped into dedicated, focused modules:

| Section | Description | Components |
| :--- | :--- | :--- |
| [**1. Actions**](actions.md) | Buttons with built-in NUI communication and loading spinners | `NuiButton` |
| [**2. Forms**](forms.md) | Form containers, inputs, selects, toggles, and file controls | `NuiForm`, `NuiInput`, `NuiSelect`, `NuiCheckbox`, `NuiRadioGroup`, `NuiDatepicker`, `NuiFileInput` |
| [**3. Layout**](layout.md) | Responsive grids, cards, flexbox, and vertical stacks | `NuiCard`, `NuiCardGrid`, `NuiFlex`, `NuiGrid`, `NuiStack` |
| [**4. Navigation**](navigation.md) | Tab systems, accordions, sidebars, and menus | `NuiTabs`, `NuiAccordion`, `NuiSidebar`, `NuiMenu`, `NuiBreadcrumbs`, `NuiPagination` |
| [**5. Overlays**](overlay.md) | Focus-trapping modals, confirmation dialogs, and tooltips | `NuiModal`, `NuiDialog`, `NuiTooltip` |
| [**6. Data Display**](data.md) | Tables with sorting/pagination, progress bars, charts, badges | `NuiTable`, `NuiChart`, `NuiBadge`, `NuiProgressBar`, `NuiList`, `NuiCodeBlock`, `NuiRichText` |
| [**7. Composables**](composables.md) | FiveM CEF keyboard shortcuts and form validation engine | `useKeyboardShortcut`, `validateForm`, `validateField` |
