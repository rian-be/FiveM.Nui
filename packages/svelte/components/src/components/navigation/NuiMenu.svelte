<script module lang="ts">
  export interface MenuItem {
    /** Unique id. Also required for separators (used as each key) */
    id: string;
    label?: string;
    icon?: string;
    disabled?: boolean;
    /** One level of submenu */
    children?: MenuItem[];
    separator?: boolean;
    onclick?: () => void;
  }
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    items: MenuItem[];
    open?: boolean;
    /** Text of the trigger button (ignored when `trigger` is provided) */
    triggerLabel?: string;
    /** Custom trigger content */
    trigger?: Snippet;
    /** Close on pointer down outside of the menu */
    closeOnOutsideClick?: boolean;
    /** Which edge of the trigger the dropdown aligns to. `end` also opens submenus to the left */
    align?: "start" | "end";
  }

  const uid = $props.id();
  const menuId = `nui-menu-${uid}`;
  const triggerId = `${menuId}-trigger`;

  let {
    items = [],
    open = $bindable(false),
    triggerLabel = "Menu",
    trigger,
    closeOnOutsideClick = true,
    align = "start",
    class: className = "",
    ...rest
  }: Props = $props();

  let containerEl: HTMLElement | null = $state(null);
  let triggerEl: HTMLButtonElement | null = $state(null);
  let dropdownEl: HTMLElement | null = $state(null);
  let openSub: string | null = $state(null);
  let focusTargetOnOpen: "first" | "last" = "first";

  function close(returnFocus = false) {
    open = false;
    openSub = null;
    if (returnFocus) triggerEl?.focus();
  }

  function toggle() {
    if (open) close();
    else open = true;
  }

  function escapeCss(str: string): string {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(str);
    }
    return str.replace(/["\\]/g, "\\$&");
  }

  function itemsOf(menu: HTMLElement | null): HTMLElement[] {
    if (!menu) return [];
    return [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
      (el) => el.closest('[role="menu"]') === menu,
    );
  }

  function getEnabledItems(menu: HTMLElement | null): HTMLElement[] {
    return itemsOf(menu).filter(
      (el) => el.getAttribute("aria-disabled") !== "true",
    );
  }

  function getNextEnabledItem(
    menu: HTMLElement,
    current: HTMLElement,
    direction: 1 | -1,
  ): HTMLElement | null {
    const all = itemsOf(menu);
    const len = all.length;
    if (len === 0) return null;
    let idx = all.indexOf(current);
    if (idx === -1) idx = direction > 0 ? -1 : 0;

    for (let step = 1; step <= len; step++) {
      const nextIdx = (idx + direction * step + len * 1000) % len;
      const candidate = all[nextIdx];
      if (candidate.getAttribute("aria-disabled") !== "true") {
        return candidate;
      }
    }
    return null;
  }

  let focusSubmenuOnOpen = false;
  let hasFocusedInitial = false;
  let typeaheadBuffer = "";
  let typeaheadTimeout: ReturnType<typeof setTimeout> | null = null;

  // Focus the item after opening, reset submenu state after closing.
  // Guarded by open && dropdownEl to ensure DOM node is bound before focusing.
  // hasFocusedInitial prevents re-renders while menu is open from stealing focus.
  $effect(() => {
    if (open && dropdownEl) {
      if (!hasFocusedInitial) {
        hasFocusedInitial = true;
        const enabled = getEnabledItems(dropdownEl);
        const all = itemsOf(dropdownEl);
        const target =
          focusTargetOnOpen === "last"
            ? (enabled[enabled.length - 1] ?? all[all.length - 1])
            : (enabled[0] ?? all[0]);
        target?.focus();
        focusTargetOnOpen = "first";
      }
    } else if (!open) {
      hasFocusedInitial = false;
      openSub = null;
      focusTargetOnOpen = "first";
      focusSubmenuOnOpen = false;
    }
  });

  // Focus the first item of submenu when opened via keyboard
  $effect(() => {
    if (openSub && focusSubmenuOnOpen && dropdownEl) {
      const panel = dropdownEl.querySelector<HTMLElement>(
        `[data-submenu-panel="${escapeCss(openSub)}"]`,
      );
      if (panel) {
        const enabled = getEnabledItems(panel);
        const first = enabled[0] ?? itemsOf(panel)[0];
        first?.focus();
        focusSubmenuOnOpen = false;
      }
    }
  });

  function activate(item: MenuItem) {
    if (item.disabled) return;
    try {
      item.onclick?.();
    } finally {
      close(true);
    }
  }

  function openSubmenu(id: string, focusFirst: boolean) {
    focusSubmenuOnOpen = focusFirst;
    openSub = id;
  }

  function closeSubmenuFromPanel(panel: HTMLElement) {
    const id = panel.dataset.submenuPanel;
    openSub = null;
    if (id) {
      dropdownEl
        ?.querySelector<HTMLElement>(`[data-submenu="${escapeCss(id)}"]`)
        ?.focus();
    }
  }

  function toggleSubmenu(item: MenuItem, event: MouseEvent) {
    if (item.disabled) return;
    // detail === 0 means the click came from the keyboard (Enter/Space)
    const fromKeyboard = event.detail === 0;
    if (openSub === item.id && fromKeyboard) {
      openSub = null;
      return;
    }
    openSubmenu(item.id, fromKeyboard);
  }

  function hoverOpen(event: PointerEvent, item: MenuItem) {
    if (event.pointerType === "mouse" && !item.disabled) openSub = item.id;
  }

  function hoverLeave(event: PointerEvent) {
    if (event.pointerType === "mouse") {
      // Do not dismiss submenu on mouse leave if keyboard focus is currently inside the submenu panel
      if (openSub && dropdownEl && typeof document !== "undefined") {
        const panel = dropdownEl.querySelector<HTMLElement>(
          `[data-submenu-panel="${escapeCss(openSub)}"]`,
        );
        if (panel && document.activeElement && panel.contains(document.activeElement)) {
          return;
        }
      }
      openSub = null;
    }
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      focusTargetOnOpen = event.key === "ArrowUp" ? "last" : "first";
      open = true;
    }
  }

  function onMenuKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const menu = target.closest<HTMLElement>('[role="menu"]');
    if (!menu) return;

    const inSubmenu = menu !== dropdownEl;
    const openSubKey = align === "end" ? "ArrowLeft" : "ArrowRight";
    const closeSubKey = align === "end" ? "ArrowRight" : "ArrowLeft";

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (inSubmenu) closeSubmenuFromPanel(menu);
      else close(true);
      return;
    }

    if (inSubmenu && event.key === closeSubKey) {
      event.preventDefault();
      closeSubmenuFromPanel(menu);
      return;
    }

    const list = itemsOf(menu);
    if (!list.includes(target)) return;

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = getNextEnabledItem(menu, target, 1);
        next?.focus();
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const prev = getNextEnabledItem(menu, target, -1);
        prev?.focus();
        break;
      }
      case "Home": {
        event.preventDefault();
        const first = getEnabledItems(menu)[0] ?? itemsOf(menu)[0];
        first?.focus();
        break;
      }
      case "End": {
        event.preventDefault();
        const enabled = getEnabledItems(menu);
        const last =
          enabled[enabled.length - 1] ??
          itemsOf(menu)[itemsOf(menu).length - 1];
        last?.focus();
        break;
      }
      case "ArrowRight":
      case "ArrowLeft": {
        if (event.key === openSubKey) {
          const id = target.dataset.submenu;
          if (id && target.getAttribute("aria-disabled") !== "true") {
            event.preventDefault();
            openSubmenu(id, true);
          }
        }
        break;
      }
      case "Tab":
        // Let the browser move focus on, starting from the trigger
        close(true);
        break;
      default: {
        if (
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          if (typeaheadTimeout) clearTimeout(typeaheadTimeout);
          typeaheadBuffer += event.key.toLowerCase();
          typeaheadTimeout = setTimeout(() => {
            typeaheadBuffer = "";
          }, 500);

          const enabled = getEnabledItems(menu);
          if (enabled.length === 0) break;
          const currIdx = enabled.indexOf(target);

          // Support multi-character matching (e.g. "du" for duplicate)
          // or single-character cycling when the same key is pressed consecutively
          const isSingleKeyCycle =
            typeaheadBuffer.length > 1 &&
            typeaheadBuffer.split("").every((c) => c === typeaheadBuffer[0]);
          const query = isSingleKeyCycle ? typeaheadBuffer[0] : typeaheadBuffer;
          const searchStart = isSingleKeyCycle ? 1 : 0;

          for (let step = searchStart; step < enabled.length + searchStart; step++) {
            const idx = (currIdx + step) % enabled.length;
            const item = enabled[idx];
            // Match against data-label attribute to avoid icons interfering with query matching
            const text = (item.getAttribute("data-label") ?? item.textContent ?? "")
              .trim()
              .toLowerCase();
            if (text.startsWith(query)) {
              item.focus();
              break;
            }
          }
        }
        break;
      }
    }
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (
      open &&
      closeOnOutsideClick &&
      containerEl &&
      !containerEl.contains(event.target as Node)
    ) {
      close();
    }
  }

  /**
   * Closes the menu when focus moves outside the component container.
   * Note: relatedTarget is null for clicks on non-focusable areas, which are handled
   * by the window pointerdown listener.
   */
  function onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (open && next && containerEl && !containerEl.contains(next)) close();
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

{#snippet leaf(item: MenuItem)}
  {#if item.separator}
    <div class="nui-menu__separator" role="separator"></div>
  {:else}
    <button
      type="button"
      role="menuitem"
      tabindex="-1"
      class="nui-menu__item"
      data-id={item.id}
      data-label={item.label}
      aria-disabled={item.disabled || undefined}
      onclick={() => activate(item)}
    >
      {#if item.icon}<span class="nui-menu__item-icon" aria-hidden="true"
          >{item.icon}</span
        >{/if}
      <span>{item.label}</span>
    </button>
  {/if}
{/snippet}

<div
  {...rest}
  class={["nui-menu", align === "end" && "nui-menu--end", className]}
  bind:this={containerEl}
  onfocusout={onFocusOut}
>
  <button
    bind:this={triggerEl}
    type="button"
    id={triggerId}
    class="nui-menu__trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? menuId : undefined}
    onclick={toggle}
    onkeydown={onTriggerKeydown}
  >
    {#if trigger}
      {@render trigger()}
    {:else}
      <span>{triggerLabel}</span>
    {/if}
    <span class="nui-menu__icon" aria-hidden="true">{open ? "▴" : "▾"}</span>
  </button>

  {#if open}
    <div
      bind:this={dropdownEl}
      id={menuId}
      class="nui-menu__dropdown"
      role="menu"
      tabindex="-1"
      aria-labelledby={triggerId}
      onkeydown={onMenuKeydown}
    >
      {#each items as item (item.id)}
        {#if !item.separator && item.children?.length}
          <div
            class="nui-menu__submenu"
            role="none"
            onpointerenter={(e) => hoverOpen(e, item)}
            onpointerleave={hoverLeave}
          >
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class="nui-menu__item"
              class:nui-menu__item--open={openSub === item.id}
              data-id={item.id}
              data-label={item.label}
              data-submenu={item.id}
              aria-haspopup="menu"
              aria-expanded={openSub === item.id}
              aria-disabled={item.disabled || undefined}
              onclick={(e) => toggleSubmenu(item, e)}
            >
              {#if item.icon}<span
                  class="nui-menu__item-icon"
                  aria-hidden="true">{item.icon}</span
                >{/if}
              <span>{item.label}</span>
              <span class="nui-menu__submenu-arrow" aria-hidden="true">›</span>
            </button>

            {#if openSub === item.id}
              <div
                class="nui-menu__submenu-content"
                role="menu"
                tabindex="-1"
                aria-label={item.label}
                data-submenu-panel={item.id}
              >
                {#each item.children as sub (sub.id)}
                  {@render leaf(sub)}
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          {@render leaf(item)}
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .nui-menu {
    position: relative;
    display: inline-block;
    font-family: inherit;
  }

  .nui-menu__trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background: var(--nui-surface-alt, #18181b);
    color: var(--nui-fg, #fafafa);
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      border-color 0.15s ease,
      background 0.15s ease;
  }

  .nui-menu__trigger:hover {
    border-color: var(--nui-primary, #3b82f6);
  }

  .nui-menu__trigger:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
  }

  .nui-menu__icon {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .nui-menu__dropdown {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 0;
    min-width: 12rem;
    background: var(--nui-surface, #18181b);
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    box-shadow: 0 10px 25px rgb(0 0 0 / 0.35);
    z-index: var(--nui-z-dropdown, 100);
    padding: 0.25rem;
  }

  .nui-menu--end .nui-menu__dropdown {
    left: auto;
    right: 0;
  }

  .nui-menu__dropdown:focus,
  .nui-menu__submenu-content:focus {
    outline: none;
  }

  .nui-menu__item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: var(--nui-radius, 0.25rem);
    color: var(--nui-fg, #fafafa);
    text-align: left;
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.15s ease;
    box-sizing: border-box;
  }

  .nui-menu__item:hover:not([aria-disabled="true"]),
  .nui-menu__item--open {
    background: var(--nui-hover, rgb(255 255 255 / 0.08));
  }

  .nui-menu__item:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: -2px;
    background: var(--nui-hover, rgb(255 255 255 / 0.08));
  }

  .nui-menu__item[aria-disabled="true"] {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-menu__item-icon {
    font-size: 0.95rem;
  }

  .nui-menu__separator {
    height: 1px;
    margin: 0.25rem 0;
    background: var(--nui-border, #27272a);
  }

  .nui-menu__submenu {
    position: relative;
  }

  .nui-menu__submenu-arrow {
    margin-left: auto;
    font-size: 0.875rem;
    opacity: 0.6;
  }

  .nui-menu__submenu-content {
    position: absolute;
    left: 100%;
    top: -0.25rem;
    min-width: 10rem;
    background: var(--nui-surface, #18181b);
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    box-shadow: 0 10px 25px rgb(0 0 0 / 0.35);
    padding: 0.25rem;
  }

  .nui-menu--end .nui-menu__submenu-content {
    left: auto;
    right: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-menu__trigger,
    .nui-menu__item {
      transition: none;
    }
  }
</style>
