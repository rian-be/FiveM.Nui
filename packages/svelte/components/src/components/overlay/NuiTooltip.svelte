<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Props {
    /** Tekst podpowiedzi */
    text: string;
    /** Pozycja podpowiedzi */
    position?: 'top' | 'bottom' | 'left' | 'right';
    /** Czas opóźnienia wyświetlania w ms */
    delay?: number;
    /** Element docelowy podpowiedzi */
    children?: import('svelte').Snippet;
  }

  let {
    text,
    position = 'top',
    delay = 150,
    children
  }: Props = $props();

  let visible = $state(false);
  let showTimer: ReturnType<typeof setTimeout> | null = null;

  function show() {
    if (showTimer) clearTimeout(showTimer);
    if (delay > 0) {
      showTimer = setTimeout(() => {
        visible = true;
      }, delay);
    } else {
      visible = true;
    }
  }

  function hide() {
    if (showTimer) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    visible = false;
  }

  const cleanup = () => {
    if (showTimer) clearTimeout(showTimer);
  };

  try {
    onDestroy(cleanup);
  } catch {
    // Outside component lifecycle
  }
</script>

<span
  class="nui-tooltip-wrapper"
  role="presentation"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
>
  {@render children?.()}

  {#if visible && text}
    <div class="nui-tooltip nui-tooltip--{position}" role="tooltip">
      {text}
    </div>
  {/if}
</span>

<style>
  .nui-tooltip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .nui-tooltip {
    position: absolute;
    padding: 0.375rem 0.625rem;
    background: var(--nui-surface-alt, #18181b);
    color: var(--nui-fg, #fafafa);
    border: 1px solid var(--nui-border, #3f3f46);
    border-radius: var(--nui-radius, 0.375rem);
    font-size: 0.75rem;
    line-height: 1.2;
    box-shadow: 0 4px 12px rgb(0 0 0 / 0.35);
    z-index: var(--nui-z-tooltip, 1100);
    pointer-events: none;
    white-space: nowrap;
    animation: nui-tooltip-pop 0.15s ease-out;
  }

  .nui-tooltip--top {
    bottom: calc(100% + 0.375rem);
    left: 50%;
    transform: translateX(-50%);
  }

  .nui-tooltip--bottom {
    top: calc(100% + 0.375rem);
    left: 50%;
    transform: translateX(-50%);
  }

  .nui-tooltip--left {
    right: calc(100% + 0.375rem);
    top: 50%;
    transform: translateY(-50%);
  }

  .nui-tooltip--right {
    left: calc(100% + 0.375rem);
    top: 50%;
    transform: translateY(-50%);
  }

  @keyframes nui-tooltip-pop {
    from {
      opacity: 0;
      transform: translate(-50%, 2px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  .nui-tooltip--left {
    animation-name: nui-tooltip-pop-left;
  }

  @keyframes nui-tooltip-pop-left {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(2px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  .nui-tooltip--right {
    animation-name: nui-tooltip-pop-right;
  }

  @keyframes nui-tooltip-pop-right {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(-2px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }
</style>