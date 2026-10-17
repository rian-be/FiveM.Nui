<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Labels {
    nav: string;
    toggle: string;
  }

  interface Props extends Omit<HTMLAttributes<HTMLElement>, "children"> {
    /** Whether the sidebar is open. Supports `bind:open` */
    open?: boolean;
    /** Show the toggle button */
    collapsible?: boolean;
    /** Sidebar width. Numbers are treated as px */
    width?: string | number;
    /** Called after the user toggled the sidebar */
    onToggle?: (open: boolean) => void;
    /** Optional class applied directly to the inner <aside> panel */
    panelClass?: string;
    /** Override texts (localization) */
    labels?: Partial<Labels>;
    brand?: Snippet;
    children?: Snippet;
    footer?: Snippet;
  }

  const uid = $props.id();
  const panelId = `nui-sidebar-${uid}`;

  const defaultLabels: Labels = { nav: "Sidebar", toggle: "Toggle sidebar" };

  let {
    id: idProp,
    open = $bindable(true),
    collapsible = false,
    width = "250px",
    onToggle,
    labels,
    brand,
    children,
    footer,
    class: className = "",
    style,
    panelClass = "",
    ...rest
  }: Props = $props();

  const resolvedId = $derived(idProp || panelId);
  const t = $derived({ ...defaultLabels, ...labels });
  const toCss = (v: string | number) => (typeof v === "number" ? `${v}px` : v);
  const styleVars = $derived(`--nui-sidebar-width:${toCss(width)};`);
  const styleExtra = $derived(typeof style === "string" ? style : "");

  function toggle() {
    open = !open;
    onToggle?.(open);
  }
</script>

<div
  class={[
    "nui-sidebar-wrap",
    !open && "nui-sidebar-wrap--collapsed",
    className,
  ]}
  style={styleVars + styleExtra}
>
  <aside
    {...rest}
    id={resolvedId}
    class={["nui-sidebar", panelClass]}
    aria-label={t.nav}
    inert={!open || undefined}
  >
    {#if brand}
      <div class="nui-sidebar__brand">{@render brand()}</div>
    {/if}

    <div class="nui-sidebar__content">{@render children?.()}</div>

    {#if footer}
      <div class="nui-sidebar__footer">{@render footer()}</div>
    {/if}
  </aside>

  {#if collapsible}
    <button
      type="button"
      class="nui-sidebar__toggle"
      aria-label={t.toggle}
      aria-expanded={open}
      aria-controls={resolvedId}
      onclick={toggle}
    >
      <span aria-hidden="true">{open ? "◀" : "▶"}</span>
    </button>
  {/if}
</div>

<style>
  .nui-sidebar-wrap {
    position: relative;
    flex: none;
    width: var(--nui-sidebar-width, 250px);
    max-width: 100%;
    height: 100%;
    box-sizing: border-box;
    transition: width 0.25s ease;
  }

  .nui-sidebar-wrap--collapsed {
    width: 0;
  }

  .nui-sidebar {
    display: flex;
    flex-direction: column;
    width: var(--nui-sidebar-width, 250px);
    height: 100%;
    background: var(--nui-surface-alt, #18181b);
    border-right: 1px solid var(--nui-border, #27272a);
    font-family: inherit;
    box-sizing: border-box;
    overflow: hidden;
    transition:
      transform 0.25s ease,
      visibility 0.25s;
  }

  .nui-sidebar-wrap--collapsed .nui-sidebar {
    transform: translateX(-100%);
    visibility: hidden;
  }

  .nui-sidebar__brand {
    border-bottom: 1px solid var(--nui-border, #27272a);
  }

  .nui-sidebar__content {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: 1rem;
  }

  .nui-sidebar__footer {
    border-top: 1px solid var(--nui-border, #27272a);
  }

  .nui-sidebar__toggle {
    position: absolute;
    top: 0.5rem;
    left: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.4rem;
    background: var(--nui-surface-alt, #18181b);
    border: 1px solid var(--nui-border, #27272a);
    border-left: 0;
    border-radius: 0 var(--nui-radius, 0.375rem) var(--nui-radius, 0.375rem) 0;
    color: var(--nui-fg-secondary, #8b8b99);
    font-size: 0.85rem;
    cursor: pointer;
    z-index: var(--nui-z-sidebar-toggle, 50);
    transition: color 0.15s ease;
  }

  .nui-sidebar__toggle:hover {
    color: var(--nui-fg, #fafafa);
  }

  .nui-sidebar__toggle:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-sidebar-wrap,
    .nui-sidebar,
    .nui-sidebar__toggle {
      transition: none;
    }
  }
</style>
