<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Exact number of equal columns. When omitted, columns auto fit by `minColumnWidth` */
    columns?: number;
    /** Gap between items. Numbers are treated as px */
    gap?: string | number;
    /** Minimum column width in auto mode. Numbers are treated as px */
    minColumnWidth?: string | number;
    children?: Snippet;
  }

  let {
    columns,
    gap = "1rem",
    minColumnWidth = "200px",
    children,
    class: className = "",
    style,
    ...rest
  }: Props = $props();

  const toCss = (v: string | number) => (typeof v === "number" ? `${v}px` : v);

  const cols = $derived(
    columns !== undefined && Number.isFinite(columns) && columns >= 1
      ? Math.floor(columns)
      : undefined,
  );

  const styleVars = $derived(
    `--nui-grid-gap:${toCss(gap)};--nui-grid-min:${toCss(minColumnWidth)};` +
      (cols ? `--nui-grid-columns:${cols};` : ""),
  );
  const styleExtra = $derived(typeof style === "string" ? style : "");
</script>

<div
  {...rest}
  class={["nui-grid", cols ? "nui-grid--fixed" : "nui-grid--auto", className]}
  style={styleVars + styleExtra}
>
  {@render children?.()}
</div>

<style>
  .nui-grid {
    display: grid;
    gap: var(--nui-grid-gap, 1rem);
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-grid--fixed {
    grid-template-columns: repeat(var(--nui-grid-columns), minmax(0, 1fr));
  }

  .nui-grid--auto {
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, var(--nui-grid-min, 200px)), 1fr)
    );
  }
</style>
