import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync, createRawSnippet, type ComponentProps } from 'svelte';
import NuiGrid from '../../src/components/layout/NuiGrid.svelte';

type GridProps = ComponentProps<typeof NuiGrid>;

describe('NuiGrid', () => {
  let container: HTMLElement;
  let mountedApps: ReturnType<typeof mount>[] = [];

  function mountGrid(props: GridProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiGrid, {
      target,
      props
    });
    mountedApps.push(inst);
    flushSync();
    const grid = target.querySelector<HTMLDivElement>('.nui-grid')!;
    return { grid, inst, target };
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

  it('renders default auto-fit mode with 1rem gap and 200px minColumnWidth', () => {
    const { grid } = mountGrid();

    expect(grid).not.toBeNull();
    expect(grid.classList.contains('nui-grid--auto')).toBe(true);
    expect(grid.classList.contains('nui-grid--fixed')).toBe(false);
    expect(grid.getAttribute('style')).toMatch(/--nui-grid-gap:\s*1rem/);
    expect(grid.getAttribute('style')).toMatch(/--nui-grid-min:\s*200px/);
  });

  it('renders fixed column mode when columns is a positive integer', () => {
    const { grid } = mountGrid({
      columns: 4,
      gap: 16,
      minColumnWidth: 150
    });

    expect(grid.classList.contains('nui-grid--fixed')).toBe(true);
    expect(grid.classList.contains('nui-grid--auto')).toBe(false);
    expect(grid.getAttribute('style')).toMatch(/--nui-grid-gap:\s*16px/);
    expect(grid.getAttribute('style')).toMatch(/--nui-grid-min:\s*150px/);
    expect(grid.getAttribute('style')).toMatch(/--nui-grid-columns:\s*4/);
  });

  it('merges custom class and style props', () => {
    const { grid } = mountGrid({
      class: 'custom-grid-cls',
      style: 'background: red;'
    });

    expect(grid.classList.contains('custom-grid-cls')).toBe(true);
    expect(grid.getAttribute('style')).toContain('background: red');
  });

  it('renders children content', () => {
    const children = createRawSnippet(() => ({
      render: () => '<div class="grid-item">Item 1</div>'
    }));

    const { grid } = mountGrid({ children });
    expect(grid.querySelector('.grid-item')?.textContent).toBe('Item 1');
  });
});
