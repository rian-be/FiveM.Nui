<script module lang="ts">
  export interface Tab {
    id: string;
    label: string;
    disabled?: boolean;
    icon?: string;
  }
</script>

<script lang="ts">
  import { nui } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    tabs: Tab[];
    client?: SvelteNuiClient;
    /** Active tab id. Supports `bind:activeTab` */
    activeTab?: string;
    /**
     * Called after the user selects a tab (via click or keyboard navigation).
     * Note: programmatic fallback adjustments (such as when `tabs` list updates or the active tab is removed) do not trigger this callback.
     */
    onTabChange?: (tabId: string) => void;
    /** Tab used when `activeTab` is empty or invalid (default: first enabled tab) */
    initialTab?: string;
    /** Event name sent to FiveM on every change */
    eventName?: string;
    /** Accessible name of the tab list */
    label?: string;
    /** Panel content. Receives the active tab id */
    children?: Snippet<[string]>;
  }

  const uid = $props.id();

  let {
    tabs = [],
    client = nui,
    activeTab = $bindable(""),
    onTabChange,
    initialTab,
    eventName,
    label = "Tabs",
    children,
    class: className = "",
    ...rest
  }: Props = $props();

  const tabId = (id: string) => `nui-tabs-${uid}-${id}-tab`;
  const panelId = `nui-tabs-${uid}-panel`;

  const firstEnabled = $derived(tabs.find((t) => !t.disabled)?.id);

  // Keep `activeTab` valid: it must exist in `tabs` and must not be disabled
  const resolvedTab = $derived.by(() => {
    const valid = (id?: string) =>
      id ? tabs.some((t) => t.id === id && !t.disabled) : false;
    if (valid(activeTab)) return activeTab;
    if (valid(initialTab)) return initialTab as string;
    return firstEnabled ?? "";
  });

  $effect.pre(() => {
    if (resolvedTab !== activeTab) activeTab = resolvedTab;
  });

  function emit(from: string, to: string) {
    onTabChange?.(to);
    if (eventName) {
      try {
        const res: unknown = client?.send(eventName, { from, to });
        if (res && typeof (res as { catch?: unknown }).catch === "function") {
          (res as Promise<unknown>).catch((err: unknown) => {
            console.warn(
              "[fivem-nui-components] NuiTabs: failed to send event",
              err,
            );
          });
        }
      } catch (err) {
        console.warn(
          "[fivem-nui-components] NuiTabs: failed to send event",
          err,
        );
      }
    }
  }

  function selectTab(id: string) {
    const tab = tabs.find((t) => t.id === id);
    if (!tab || tab.disabled || resolvedTab === id) return;
    const from = resolvedTab;
    activeTab = id;
    emit(from, id);
  }

  function onKeydown(event: KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const enabled = tabs.filter((t) => !t.disabled);
    if (enabled.length === 0) return;

    const current = enabled.findIndex((t) => t.id === resolvedTab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % enabled.length;
    else if (event.key === "ArrowLeft")
      next = (current - 1 + enabled.length) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;

    event.preventDefault();
    const target = enabled[next];
    selectTab(target.id);
    (event.currentTarget as HTMLElement)
      .querySelector<HTMLElement>(`#${CSS.escape(tabId(target.id))}`)
      ?.focus();
  }
</script>

<div {...rest} class={["nui-tabs", className]}>
  <div
    class="nui-tabs__list"
    role="tablist"
    aria-label={label}
    tabindex="-1"
    onkeydown={onKeydown}
  >
    {#each tabs as tab (tab.id)}
      {@const selected = tab.id === resolvedTab}
      <button
        type="button"
        id={tabId(tab.id)}
        class="nui-tabs__tab"
        class:nui-tabs__tab--active={selected}
        role="tab"
        aria-selected={selected}
        aria-controls={children ? panelId : undefined}
        tabindex={selected ? 0 : -1}
        disabled={tab.disabled}
        onclick={() => selectTab(tab.id)}
      >
        {#if tab.icon}<span class="nui-tabs__icon" aria-hidden="true"
            >{tab.icon}</span
          >{/if}
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  {#if children && resolvedTab}
    <div
      id={panelId}
      class="nui-tabs__content"
      role="tabpanel"
      tabindex="0"
      aria-labelledby={tabId(resolvedTab)}
    >
      {@render children(resolvedTab)}
    </div>
  {/if}
</div>

<style>
  .nui-tabs {
    display: flex;
    flex-direction: column;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-tabs__list {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--nui-border, #27272a);
    background: var(--nui-surface-alt, #101012);
    padding: 0.25rem 0.5rem 0;
    overflow-x: auto;
  }

  .nui-tabs__list:focus {
    outline: none;
  }

  .nui-tabs__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.625rem 1rem;
    border: 1px solid transparent;
    border-bottom: 2px solid transparent;
    border-radius: var(--nui-radius, 0.375rem) var(--nui-radius, 0.375rem) 0 0;
    background: transparent;
    color: var(--nui-fg-secondary, #8b8b99);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease,
      border-color 0.15s ease;
  }

  .nui-tabs__tab:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
    color: var(--nui-fg, #fafafa);
  }

  .nui-tabs__tab:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: -2px;
  }

  .nui-tabs__tab--active {
    border-color: var(--nui-border, #27272a);
    border-bottom-color: var(--nui-primary, #3b82f6);
    background: var(--nui-surface, #18181b);
    color: var(--nui-fg, #fafafa);
    font-weight: 600;
  }

  .nui-tabs__tab:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-tabs__content {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
    background: var(--nui-surface, #18181b);
    color: var(--nui-fg, #fafafa);
  }

  .nui-tabs__content:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: -2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-tabs__tab {
      transition: none;
    }
  }
</style>
