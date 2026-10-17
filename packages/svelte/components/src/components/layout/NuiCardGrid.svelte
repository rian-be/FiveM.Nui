<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** Max number of columns (responsive) or exact count (fixed) */
    columns?: number | `${number}` | (string & {});
    /**
     * Gap between cards. Numbers are treated as px (e.g. 16 -> '16px').
     * Fixed units (rem, px) are recommended; percentage units in responsive mode may produce
     * variable track minimums because container-relative calc() evaluation depends on outer context.
     */
    gap?: string | number;
    /** Auto fit columns by `minCardWidth`, capped by `columns` */
    responsive?: boolean;
    /** Minimum card width. Numbers are treated as px */
    minCardWidth?: string | number;
    /** Center cards within their cells */
    center?: boolean;
    children?: Snippet;
  }

  let {
    columns = 3,
    gap = "1rem",
    responsive = true,
    minCardWidth = "250px",
    center = false,
    children,
    class: className = "",
    style,
    ...rest
  }: Props = $props();

  const toCss = (v: string | number | undefined | null, fallback: string) => {
    if (typeof v === "number") return `${v}px`;
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    return fallback;
  };

  const cols = $derived.by(() => {
    if (columns == null) return 3;
    const num = Number(columns);
    if (!Number.isFinite(num)) return 1;
    return Math.max(1, Math.floor(num));
  });

  const styleVars = $derived(
    `--nui-card-columns:${cols};--nui-card-gap:${toCss(gap, "1rem")};--nui-card-min-width:${toCss(minCardWidth, "250px")};`,
  );
  /**
   * Concatenate extra inline style. Svelte 5 passes style strings here; non-string values are safely ignored.
   */
  const styleExtra = $derived(typeof style === "string" ? style : "");
</script>

<div
  {...rest}
  class={[
    "nui-card-grid",
    responsive ? "nui-card-grid--responsive" : "nui-card-grid--fixed",
    center && "nui-card-grid--center",
    className,
  ]}
  style={styleVars + styleExtra}
>
  {@render children?.()}
</div>

<style>
  .nui-card-grid {
    display: grid;
    gap: var(--nui-card-gap, 1rem);
    width: 100%;
    font-family: inherit;
    box-sizing: border-box;
  }

  .nui-card-grid--responsive {
    --_gap-total: calc((var(--nui-card-columns) - 1) * var(--nui-card-gap));
    --_min: min(
      100%,
      max(
        var(--nui-card-min-width),
        calc((100% - var(--_gap-total)) / var(--nui-card-columns))
      )
    );
    grid-template-columns: repeat(auto-fit, minmax(var(--_min), 1fr));
  }

  .nui-card-grid--fixed {
    grid-template-columns: repeat(var(--nui-card-columns), minmax(0, 1fr));
  }

  .nui-card-grid--center {
    justify-items: center;
  }
</style>
