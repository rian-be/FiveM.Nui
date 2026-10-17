<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Direction = "row" | "column" | "row-reverse" | "column-reverse";
  type Align = "start" | "center" | "end" | "stretch" | "baseline";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Stack direction. Note: `*-reverse` changes visual order only, not DOM/tab order */
    direction?: Direction;
    /**
     * Push items to opposite ends (`space-between`).
     * Needs extra space along the main axis, eg. parent defined height in column mode.
     * Note: for single child, items align at the start.
     */
    distribute?: boolean;
    /** Cross axis alignment */
    align?: Align;
    /** Allow items to wrap onto multiple lines */
    wrap?: boolean;
    /** Gap between items. Numbers are treated as px. Default: `0.5rem` (tighter than NuiFlex's `1rem`) */
    gap?: string | number;
    /** Render as inline flex */
    inline?: boolean;
    children?: Snippet;
  }

  let {
    direction = "column",
    distribute = false,
    align = "stretch",
    wrap = false,
    gap = "0.5rem",
    inline = false,
    children,
    class: className = "",
    style,
    ...rest
  }: Props = $props();

  const toCss = (v: string | number) => (typeof v === "number" ? `${v}px` : v);
  const styleVars = $derived(`--nui-stack-gap:${toCss(gap)};`);
  const styleExtra = $derived(typeof style === "string" ? style : "");
</script>

<div
  {...rest}
  class={[
    "nui-stack",
    `nui-stack--${direction}`,
    `nui-stack--align-${align}`,
    distribute && "nui-stack--distribute",
    wrap && "nui-stack--wrap",
    inline && "nui-stack--inline",
    className,
  ]}
  style={styleVars + styleExtra}
>
  {@render children?.()}
</div>

<style>
  .nui-stack {
    display: flex;
    gap: var(--nui-stack-gap, 0.5rem);
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-stack--inline {
    display: inline-flex;
  }

  .nui-stack--row {
    flex-direction: row;
  }
  .nui-stack--column {
    flex-direction: column;
  }
  .nui-stack--row-reverse {
    flex-direction: row-reverse;
  }
  .nui-stack--column-reverse {
    flex-direction: column-reverse;
  }

  .nui-stack--distribute {
    justify-content: space-between;
  }
  .nui-stack--wrap {
    flex-wrap: wrap;
  }

  .nui-stack--align-start {
    align-items: flex-start;
  }
  .nui-stack--align-center {
    align-items: center;
  }
  .nui-stack--align-end {
    align-items: flex-end;
  }
  .nui-stack--align-stretch {
    align-items: stretch;
  }
  .nui-stack--align-baseline {
    align-items: baseline;
  }
</style>
