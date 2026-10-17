<script lang="ts">
  interface MenuItem {
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    children?: MenuItem[];
    separator?: boolean;
    onclick?: () => void;
  }

  interface Props {
    /** Elementy menu */
    items: MenuItem[];
    /** Czy menu jest otwarte */
    open?: boolean;
    /** Treść przycisku otwierającego */
    triggerLabel?: string;
    /** Czy zamykać klikając poza menu */
    closeOnOutsideClick?: boolean;
  }

  let {
    items = [],
    open = $bindable(false),
    triggerLabel = 'Menu',
    closeOnOutsideClick = true
  }: Props = $props();

  let containerEl: HTMLElement | null = $state(null);

  function close() {
    open = false;
  }

  function toggle() {
    open = !open;
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (open && closeOnOutsideClick && containerEl && !containerEl.contains(event.target as Node)) {
      close();
    }
  }
</script>

<svelte:window onpointerdown={handleWindowPointerDown} />

<div class="nui-menu" bind:this={containerEl}>
  <button
    type="button"
    class="nui-menu__trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
  >
    <span>{triggerLabel}</span>
    <span class="nui-menu__icon" aria-hidden="true">{open ? '▴' : '▾'}</span>
  </button>

  {#if open}
    <div class="nui-menu__dropdown" role="menu">
      {#each items as item (item.id || item.label)}
        {#if item.separator}
          <hr class="nui-menu__separator" />
        {:else if item.children?.length}
          <div class="nui-menu__submenu">
            <div class="nui-menu__submenu-header">
              {#if item.icon}<span class="nui-menu__item-icon">{item.icon}</span>{/if}
              <span>{item.label}</span>
              <span class="nui-menu__submenu-arrow">›</span>
            </div>
            <div class="nui-menu__submenu-content">
              {#each item.children as subItem (subItem.id || subItem.label)}
                <button
                  type="button"
                  class="nui-menu__item"
                  disabled={subItem.disabled}
                  onclick={() => {
                    subItem.onclick?.();
                    close();
                  }}
                >
                  {#if subItem.icon}<span class="nui-menu__item-icon">{subItem.icon}</span>{/if}
                  <span>{subItem.label}</span>
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <button
            type="button"
            class="nui-menu__item"
            disabled={item.disabled}
            onclick={() => {
              item.onclick?.();
              close();
            }}
          >
            {#if item.icon}<span class="nui-menu__item-icon">{item.icon}</span>{/if}
            <span>{item.label}</span>
          </button>
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
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .nui-menu__trigger:hover {
    border-color: var(--nui-primary, #3b82f6);
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

  .nui-menu__item {
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-sizing: border-box;
  }

  .nui-menu__item:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.08));
  }

  .nui-menu__item:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-menu__item-icon {
    font-size: 0.95rem;
  }

  .nui-menu__separator {
    border: 0;
    border-top: 1px solid var(--nui-border, #27272a);
    margin: 0.25rem 0;
  }

  .nui-menu__submenu {
    position: relative;
  }

  .nui-menu__submenu-header {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.45rem 0.75rem;
    background: transparent;
    border: none;
    color: var(--nui-fg, #fafafa);
    font: inherit;
    font-size: 0.8125rem;
  }

  .nui-menu__submenu-arrow {
    margin-left: auto;
    font-size: 0.875rem;
    opacity: 0.6;
  }

  .nui-menu__submenu-content {
    position: absolute;
    left: 100%;
    top: 0;
    margin-left: 0.25rem;
    min-width: 10rem;
    background: var(--nui-surface, #18181b);
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    box-shadow: 0 10px 25px rgb(0 0 0 / 0.35);
    z-index: 101;
    padding: 0.25rem;
  }
</style>
