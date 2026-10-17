<script module lang="ts">
  import type { Snippet } from "svelte";

  export interface AccordionItem {
    id: string;
    title: string;
    /** Plain text content. Rendered as text (never as HTML) */
    content?: string;
    disabled?: boolean;
  }

  export interface AccordionToggleEvent {
    id: string;
    isOpen: boolean;
    openIds: string[];
    /** Single mode only: the section that was open before and is now closed */
    previousId?: string;
  }
</script>

<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { nui } from "@fivem-nui/svelte";
  import type { SvelteNuiClient } from "@fivem-nui/svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    items: AccordionItem[];
    client?: SvelteNuiClient;
    /** Called after every toggle */
    onToggle?: (data: AccordionToggleEvent) => void;
    /** Event name sent to FiveM on every toggle */
    eventName?: string;
    /** Allow several sections open at once */
    multiple?: boolean;
    /** Open all sections initially (ignored when `multiple` is false) */
    defaultOpenAll?: boolean;
    /** Initially open ids (trimmed to the first one when `multiple` is false) */
    defaultOpenIds?: string[];
    /** Custom panel content. Receives the item. Takes precedence over `item.content` */
    panel?: Snippet<[AccordionItem]>;
  }

  const uid = $props.id();

  let {
    items = [],
    client = nui,
    onToggle,
    eventName,
    multiple = false,
    defaultOpenAll = false,
    defaultOpenIds = [],
    panel,
    class: className = "",
    ...rest
  }: Props = $props();

  const openIds = new SvelteSet<string>();
  let initialized = false;

  $effect.pre(() => {
    if (initialized || items.length === 0) return;
    initialized = true;

    let initial =
      defaultOpenAll && multiple ? items.map((i) => i.id) : defaultOpenIds;
    if (!multiple) initial = initial.slice(0, 1);

    const known = new Set(items.map((i) => i.id));
    for (const id of initial) if (known.has(id)) openIds.add(id);
  });

  // Drop ids that no longer exist in `items`
  $effect(() => {
    const known = new Set(items.map((i) => i.id));
    for (const id of [...openIds]) if (!known.has(id)) openIds.delete(id);
  });

  function toggle(item: AccordionItem) {
    if (item.disabled) return;

    const { id } = item;
    const wasOpen = openIds.has(id);
    let previousId: string | undefined;

    if (multiple) {
      if (wasOpen) openIds.delete(id);
      else openIds.add(id);
    } else {
      const other = [...openIds].find((x) => x !== id);
      previousId = other;
      openIds.clear();
      if (!wasOpen) openIds.add(id);
    }

    const payload: AccordionToggleEvent = {
      id,
      isOpen: !wasOpen,
      openIds: [...openIds],
      previousId,
    };

    onToggle?.(payload);

    if (eventName) {
      try {
        const res: unknown = client?.send(eventName, { ...payload, count: payload.openIds.length });
        if (res && typeof (res as { catch?: unknown }).catch === "function") {
          (res as Promise<unknown>).catch((err: unknown) => {
            console.warn(
              "[fivem-nui-components] NuiAccordion: failed to send event",
              err,
            );
          });
        }
      } catch (err) {
        console.warn(
          "[fivem-nui-components] NuiAccordion: failed to send event",
          err,
        );
      }
    }
  }

  function onKeydown(event: KeyboardEvent) {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const root = event.currentTarget as HTMLElement;
    const headers = [
      ...root.querySelectorAll<HTMLButtonElement>(
        ".nui-accordion__header:not(:disabled)",
      ),
    ];
    const current = headers.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (current === -1) return;

    event.preventDefault();
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % headers.length;
    else if (event.key === "ArrowUp")
      next = (current - 1 + headers.length) % headers.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = headers.length - 1;
    headers[next]?.focus();
  }
</script>

<div {...rest} class={["nui-accordion", className]} onkeydown={onKeydown}>
  {#each items as item (item.id)}
    {@const isOpen = openIds.has(item.id)}
    {@const headerId = `nui-acc-${uid}-${item.id}-header`}
    {@const panelId = `nui-acc-${uid}-${item.id}-panel`}
    <div class="nui-accordion__item">
      <button
        type="button"
        id={headerId}
        class="nui-accordion__header"
        class:nui-accordion__header--open={isOpen}
        disabled={item.disabled}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onclick={() => toggle(item)}
      >
        <span class="nui-accordion__title">{item.title}</span>
        <span class="nui-accordion__icon" aria-hidden="true">▾</span>
      </button>

      {#if isOpen}
        <div
          id={panelId}
          class="nui-accordion__panel"
          role="region"
          aria-labelledby={headerId}
        >
          <div class="nui-accordion__content">
            {#if panel}
              {@render panel(item)}
            {:else if item.content !== undefined}
              {item.content}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .nui-accordion {
    display: flex;
    flex-direction: column;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-accordion__item {
    border-bottom: 1px solid var(--nui-border, #27272a);
  }

  .nui-accordion__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--nui-surface-alt, #101012);
    border: none;
    border-radius: 0;
    color: var(--nui-fg, #fafafa);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .nui-accordion__header:hover:not(:disabled) {
    background: var(--nui-hover, rgb(255 255 255 / 0.06));
  }

  .nui-accordion__header:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: -2px;
  }

  .nui-accordion__header:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nui-accordion__header--open {
    background: var(--nui-surface, #18181b);
  }

  .nui-accordion__title {
    flex: 1;
    text-align: left;
    font-size: 0.875rem;
  }

  .nui-accordion__icon {
    font-size: 0.85rem;
    opacity: 0.6;
    transition: transform 0.2s ease;
  }

  .nui-accordion__header--open .nui-accordion__icon {
    transform: rotate(180deg);
  }

  .nui-accordion__panel {
    background: var(--nui-surface, #18181b);
    color: var(--nui-fg, #fafafa);
  }

  .nui-accordion__content {
    padding: 1rem;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-accordion__header,
    .nui-accordion__icon {
      transition: none;
    }
  }
</style>
