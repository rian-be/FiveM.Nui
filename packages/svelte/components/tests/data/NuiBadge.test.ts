import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet, type ComponentProps } from 'svelte';
import NuiBadge from '../../src/components/data/NuiBadge.svelte';

type BadgeProps = ComponentProps<typeof NuiBadge>;

describe('NuiBadge', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountBadge(props: BadgeProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiBadge, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const badge = target.querySelector<HTMLElement>('.nui-badge');
    return { badge, inst, target };
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

  it('renders default non-clickable badge with dot indicator when count is 0 and no children', () => {
    const { badge } = mountBadge();

    expect(badge).not.toBeNull();
    expect(badge?.tagName.toLowerCase()).toBe('span');
    expect(badge?.classList.contains('nui-badge--primary')).toBe(true);
    expect(badge?.classList.contains('nui-badge--md')).toBe(true);
    expect(badge?.classList.contains('nui-badge--rounded')).toBe(true);
    expect(badge?.textContent?.trim()).toBe('●');
  });

  it('renders numeric count and caps at maxCount with a plus sign', () => {
    const { badge: b1 } = mountBadge({
      count: 5
    });
    expect(b1?.textContent?.trim()).toBe('5');

    const { badge: b2 } = mountBadge({
      count: 150,
      maxCount: 99
    });
    expect(b2?.textContent?.trim()).toBe('99+');
  });

  it('displays 0 when showZero is true', () => {
    const { badge } = mountBadge({
      count: 0,
      showZero: true
    });
    expect(badge?.textContent?.trim()).toBe('0');
  });

  it('renders children snippet when count is not displayed', () => {
    const children = createRawSnippet(() => ({
      render: () => '<span id="badge-content">NEW</span>'
    }));

    const { badge } = mountBadge({ children });
    expect(badge?.querySelector('#badge-content')?.textContent).toBe('NEW');
  });

  it('renders as button when clickable or onclick is provided', () => {
    const onclick = vi.fn();

    const { badge } = mountBadge({
      clickable: true,
      onclick,
      count: 3
    });

    expect(badge?.tagName.toLowerCase()).toBe('button');
    expect(badge?.classList.contains('nui-badge--clickable')).toBe(true);

    (badge as HTMLButtonElement).click();
    flushSync();

    expect(onclick).toHaveBeenCalled();
  });

  it('supports variant, size, outline, and square styling', () => {
    const { badge } = mountBadge({
      variant: 'success',
      size: 'lg',
      outline: true,
      rounded: false
    });

    expect(badge?.classList.contains('nui-badge--success')).toBe(true);
    expect(badge?.classList.contains('nui-badge--lg')).toBe(true);
    expect(badge?.classList.contains('nui-badge--outline')).toBe(true);
    expect(badge?.classList.contains('nui-badge--square')).toBe(true);
  });

  it('renders nothing when visible is false', () => {
    const { badge, target } = mountBadge({
      visible: false
    });

    expect(badge).toBeNull();
    expect(target.children.length).toBe(0);
  });
});
