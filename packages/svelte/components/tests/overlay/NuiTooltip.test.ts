import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet, type ComponentProps } from 'svelte';
import NuiTooltip from '../../src/components/overlay/NuiTooltip.svelte';

type TooltipProps = ComponentProps<typeof NuiTooltip>;

describe('NuiTooltip', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountTooltip(props: TooltipProps) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiTooltip, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const wrapper = target.querySelector<HTMLSpanElement>('.nui-tooltip-wrapper')!;
    return { wrapper, inst, target };
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      unmount(mountedApps.pop()!);
    }
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders children and hides tooltip initially', () => {
    const children = createRawSnippet(() => ({
      render: () => '<button id="target-btn">Hover me</button>'
    }));

    const { wrapper, target } = mountTooltip({
      text: 'Helpful explanation',
      children
    });

    expect(wrapper).not.toBeNull();
    expect(target.querySelector('#target-btn')).not.toBeNull();
    expect(target.querySelector('.nui-tooltip')).toBeNull();
  });

  it('shows tooltip immediately when delay is 0 on mouseenter and hides on mouseleave', () => {
    const { wrapper, target } = mountTooltip({
      text: 'Instant tip',
      delay: 0
    });

    wrapper.dispatchEvent(new MouseEvent('mouseenter'));
    flushSync();

    const tooltip = target.querySelector<HTMLDivElement>('.nui-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent?.trim()).toBe('Instant tip');
    expect(tooltip?.classList.contains('nui-tooltip--top')).toBe(true);

    wrapper.dispatchEvent(new MouseEvent('mouseleave'));
    flushSync();

    expect(target.querySelector('.nui-tooltip')).toBeNull();
  });

  it('shows tooltip with delay and supports positions (e.g. bottom)', () => {
    vi.useFakeTimers();
    try {
      const { wrapper, target } = mountTooltip({
        text: 'Bottom tip',
        position: 'bottom',
        delay: 200
      });

      wrapper.dispatchEvent(new MouseEvent('mouseenter'));
      flushSync();

      expect(target.querySelector('.nui-tooltip')).toBeNull();

      vi.advanceTimersByTime(250);
      flushSync();

      const tooltip = target.querySelector<HTMLDivElement>('.nui-tooltip');
      expect(tooltip).not.toBeNull();
      expect(tooltip?.classList.contains('nui-tooltip--bottom')).toBe(true);

      wrapper.dispatchEvent(new MouseEvent('mouseleave'));
      flushSync();

      expect(target.querySelector('.nui-tooltip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
