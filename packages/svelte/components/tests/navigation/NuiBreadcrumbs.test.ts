import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, type ComponentProps } from 'svelte';
import NuiBreadcrumbs from '../../src/components/navigation/NuiBreadcrumbs.svelte';

type BreadcrumbsProps = ComponentProps<typeof NuiBreadcrumbs>;

describe('NuiBreadcrumbs', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountBreadcrumbs(props: BreadcrumbsProps) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiBreadcrumbs, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const nav = target.querySelector<HTMLElement>('.nui-breadcrumbs')!;
    return { nav, inst, target };
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

  it('renders list of breadcrumbs and automatically activates the last crumb when none is explicitly active', () => {
    const { nav } = mountBreadcrumbs({
      crumbs: [
        { label: 'Home', href: '/' },
        { label: 'Settings', href: '/settings' },
        { label: 'Profile' }
      ]
    });

    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb');

    const links = nav.querySelectorAll<HTMLAnchorElement>('.nui-breadcrumbs__link');
    expect(links.length).toBe(2);
    expect(links[0].textContent?.trim()).toBe('Home');
    expect(links[1].textContent?.trim()).toBe('Settings');

    const activeCrumb = nav.querySelector<HTMLSpanElement>('.nui-breadcrumbs__crumb--active');
    expect(activeCrumb?.textContent?.trim()).toBe('Profile');
    expect(activeCrumb?.getAttribute('aria-current')).toBe('page');
  });

  it('respects explicitly active crumb', () => {
    const { nav } = mountBreadcrumbs({
      crumbs: [
        { label: 'Home', href: '/' },
        { label: 'Dashboard', href: '/dashboard', active: true },
        { label: 'Stats', href: '/stats' }
      ]
    });

    const activeCrumb = nav.querySelector<HTMLSpanElement>('.nui-breadcrumbs__crumb--active');
    expect(activeCrumb?.textContent?.trim()).toBe('Dashboard');
  });

  it('invokes onSelect and prevents default navigation when link is clicked', () => {
    const onSelect = vi.fn();

    const { nav } = mountBreadcrumbs({
      crumbs: [
        { label: 'Home', href: '#home' },
        { label: 'About', href: '#about' }
      ],
      onSelect
    });

    const firstLink = nav.querySelector<HTMLAnchorElement>('.nui-breadcrumbs__link')!;
    firstLink.click();
    flushSync();

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Home', href: '#home' }),
      0,
      expect.any(MouseEvent)
    );
  });

  it('renders all crumbs as non-clickable spans when clickable is false', () => {
    const { nav } = mountBreadcrumbs({
      clickable: false,
      crumbs: [
        { label: 'Step 1', href: '/step-1' },
        { label: 'Step 2', href: '/step-2' }
      ]
    });

    const links = nav.querySelectorAll('.nui-breadcrumbs__link');
    expect(links.length).toBe(0);

    const spans = nav.querySelectorAll('.nui-breadcrumbs__crumb');
    expect(spans.length).toBe(2);
  });
});
