<script module lang="ts">
  export interface Crumb {
    label: string;
    href?: string;
    /** Marks the current page. When no crumb is active, the last one is treated as current */
    active?: boolean;
  }
</script>

<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends Omit<HTMLAttributes<HTMLElement>, "children"> {
    crumbs: Crumb[];
    /** When false, crumbs render as plain text instead of links */
    clickable?: boolean;
    /** Accessible name of the navigation landmark */
    label?: string;
    /** Called when link crumb is activated. Calling it suppresses native navigation */
    onSelect?: (crumb: Crumb, index: number, event: MouseEvent) => void;
  }

  let {
    crumbs,
    clickable = true,
    label = "Breadcrumb",
    onSelect,
    class: className = "",
    ...rest
  }: Props = $props();

  const currentIndex = $derived.by(() => {
    const explicit = crumbs.findIndex((c) => c.active);
    return explicit !== -1 ? explicit : crumbs.length - 1;
  });

  function handleClick(event: MouseEvent, crumb: Crumb, index: number) {
    if (!onSelect) return;
    event.preventDefault();
    onSelect(crumb, index, event);
  }
</script>

<nav {...rest} class={["nui-breadcrumbs", className]} aria-label={label}>
  <ol class="nui-breadcrumbs__list">
    {#each crumbs as crumb, i (i)}
      {@const isCurrent = i === currentIndex}
      <li class="nui-breadcrumbs__item">
        {#if crumb.href && clickable && !isCurrent}
          <a
            href={crumb.href}
            class="nui-breadcrumbs__link"
            onclick={(e) => handleClick(e, crumb, i)}
          >
            {crumb.label}
          </a>
        {:else}
          <span
            class="nui-breadcrumbs__crumb"
            class:nui-breadcrumbs__crumb--active={isCurrent}
            aria-current={isCurrent ? "page" : undefined}
          >
            {crumb.label}
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .nui-breadcrumbs {
    display: block;
  }

  .nui-breadcrumbs__list {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.875rem;
  }

  .nui-breadcrumbs__item {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  /* Decorative separator: not in the DOM, not read by screen readers */
  .nui-breadcrumbs__item + .nui-breadcrumbs__item::before {
    content: "›";
    color: var(--nui-border, #3f3f46);
    margin: 0 0.5rem 0 0;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .nui-breadcrumbs__link {
    color: var(--nui-fg-secondary, #8b8b99);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .nui-breadcrumbs__link:hover {
    color: var(--nui-primary, #3b82f6);
    text-decoration: underline;
  }

  .nui-breadcrumbs__link:focus-visible {
    outline: 2px solid var(--nui-primary, #3b82f6);
    outline-offset: 2px;
    border-radius: 2px;
  }

  .nui-breadcrumbs__crumb {
    color: var(--nui-fg-secondary, #8b8b99);
  }

  .nui-breadcrumbs__crumb--active {
    color: var(--nui-fg, #fafafa);
    font-weight: 500;
  }

  @media (prefers-reduced-motion: reduce) {
    .nui-breadcrumbs__link {
      transition: none;
    }
  }
</style>
