import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet, type ComponentProps } from 'svelte';
import NuiFlex from '../../src/components/layout/NuiFlex.svelte';

type FlexProps = ComponentProps<typeof NuiFlex>;

describe('NuiFlex', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountFlex(props: FlexProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiFlex, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const flex = target.querySelector<HTMLDivElement>('.nui-flex')!;
    return { flex, inst, target };
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
  });

  it('renders default props: direction=row, justify=start, align=stretch, gap=1rem', () => {
    const { flex } = mountFlex();

    expect(flex).not.toBeNull();
    expect(flex.classList.contains('nui-flex--row')).toBe(true);
    expect(flex.classList.contains('nui-flex--justify-start')).toBe(true);
    expect(flex.classList.contains('nui-flex--align-stretch')).toBe(true);
    expect(flex.classList.contains('nui-flex--wrap')).toBe(false);
    expect(flex.classList.contains('nui-flex--inline')).toBe(false);
    expect(flex.getAttribute('style')).toMatch(/--nui-flex-gap:\s*1rem/);
  });

  it('supports custom direction, justify, align, wrap, and inline', () => {
    const { flex } = mountFlex({
      direction: 'column-reverse',
      justify: 'between',
      align: 'center',
      wrap: true,
      inline: true
    });

    expect(flex.classList.contains('nui-flex--column-reverse')).toBe(true);
    expect(flex.classList.contains('nui-flex--justify-between')).toBe(true);
    expect(flex.classList.contains('nui-flex--align-center')).toBe(true);
    expect(flex.classList.contains('nui-flex--wrap')).toBe(true);
    expect(flex.classList.contains('nui-flex--inline')).toBe(true);
  });

  it('converts numeric gap to px string', () => {
    const { flex } = mountFlex({
      gap: 24
    });

    expect(flex.getAttribute('style')).toMatch(/--nui-flex-gap:\s*24px/);
  });

  it('merges custom class and inline styles', () => {
    const { flex } = mountFlex({
      class: 'my-custom-flex',
      style: 'opacity: 0.8;'
    });

    expect(flex.classList.contains('my-custom-flex')).toBe(true);
    expect(flex.getAttribute('style')).toMatch(/--nui-flex-gap:\s*1rem/);
    expect(flex.getAttribute('style')).toContain('opacity: 0.8');
  });

  it('renders children snippet', () => {
    const children = createRawSnippet(() => ({
      render: () => '<p id="child-elem">Hello Flex</p>'
    }));

    const { flex } = mountFlex({ children });
    expect(flex.querySelector('#child-elem')?.textContent).toBe('Hello Flex');
  });
});
