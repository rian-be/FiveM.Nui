<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Direction = "row" | "column" | "row-reverse" | "column-reverse";
  type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";
  type Align = "start" | "center" | "end" | "stretch" | "baseline";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Main axis direction. Note: `*-reverse` changes visual order only, not DOM/tab order */
    direction?: Direction;
    /** Alignment along the main axis */
    justify?: Justify;
    /** Alignment along the cross axis */
    align?: Align;
    /** Allow items to wrap onto multiple lines */
    wrap?: boolean;
    /** Gap between items. Numbers are treated as px */
    gap?: string | number;
    /** Render as inline-flex */
    inline?: boolean;
    children?: Snippet;
  }

  let {
    direction = "row",
    justify = "start",
    align = "stretch",
    wrap = false,
    gap = "1rem",
    inline = false,
    children,
    class: className = "",
    style,
    ...rest
  }: Props = $props();

  const toCss = (v: string | number) => (typeof v === "number" ? `${v}px` : v);
  const styleVars = $derived(`--nui-flex-gap:${toCss(gap)};`);
  const styleExtra = $derived(typeof style === "string" ? style : "");
</script>

<div
  {...rest}
  class={[
    "nui-flex",
    `nui-flex--${direction}`,
    `nui-flex--justify-${justify}`,
    `nui-flex--align-${align}`,
    wrap && "nui-flex--wrap",
    inline && "nui-flex--inline",
    className,
  ]}
  style={styleVars + styleExtra}
>
  {@render children?.()}
</div>

<style>
  .nui-flex {
    display: flex;
    gap: var(--nui-flex-gap, 1rem);
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-flex--inline {
    display: inline-flex;
  }
  .nui-flex--wrap {
    flex-wrap: wrap;
  }

  .nui-flex--row {
    flex-direction: row;
  }
  .nui-flex--column {
    flex-direction: column;
  }
  .nui-flex--row-reverse {
    flex-direction: row-reverse;
  }
  .nui-flex--column-reverse {
    flex-direction: column-reverse;
  }

  .nui-flex--justify-start {
    justify-content: flex-start;
  }
  .nui-flex--justify-center {
    justify-content: center;
  }
  .nui-flex--justify-end {
    justify-content: flex-end;
  }
  .nui-flex--justify-between {
    justify-content: space-between;
  }
  .nui-flex--justify-around {
    justify-content: space-around;
  }
  .nui-flex--justify-evenly {
    justify-content: space-evenly;
  }

  .nui-flex--align-start {
    align-items: flex-start;
  }
  .nui-flex--align-center {
    align-items: center;
  }
  .nui-flex--align-end {
    align-items: flex-end;
  }
  .nui-flex--align-stretch {
    align-items: stretch;
  }
  .nui-flex--align-baseline {
    align-items: baseline;
  }
</style>
