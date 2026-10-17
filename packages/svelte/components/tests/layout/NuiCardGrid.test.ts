import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, createRawSnippet, type ComponentProps } from 'svelte';
import { flushSync, bindState } from '../helpers/testHelper.svelte';
import NuiCardGrid from '../../src/components/layout/NuiCardGrid.svelte';

type GridProps = ComponentProps<typeof NuiCardGrid> & Record<string, unknown>;
type MountedComponent = ReturnType<typeof mount>;

describe('NuiCardGrid', () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];

  function mountGrid(props: GridProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiCardGrid, {
      target,
      props: props as ComponentProps<typeof NuiCardGrid>
    });
    mountedApps.push(inst);
    flushSync();
    const grid = target.querySelector<HTMLDivElement>('.nui-card-grid')!;
    return { grid, inst, target };
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      const app = mountedApps.pop()!;
      unmount(app);
    }
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders grid with default CSS variables and responsive modifier when mounted without props', () => {
    const { grid } = mountGrid();

    expect(grid).not.toBeNull();
    expect(grid.classList.contains('nui-card-grid')).toBe(true);
    expect(grid.classList.contains('nui-card-grid--responsive')).toBe(true);
    expect(grid.classList.contains('nui-card-grid--fixed')).toBe(false);
    expect(grid.classList.contains('nui-card-grid--center')).toBe(false);

    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('1rem');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('250px');
  });

  it('renders grid with specified CSS variables', () => {
    const { grid } = mountGrid({
      columns: 4,
      gap: '1.5rem',
      minCardWidth: '280px'
    });

    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('4');
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('1.5rem');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('280px');
  });

  it('converts number gap and minCardWidth to px values', () => {
    const { grid } = mountGrid({
      gap: 20,
      minCardWidth: 300
    });

    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('20px');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('300px');
  });

  it('handles gap: 0 and minCardWidth: 0 as valid 0px values without falling back to defaults', () => {
    const { grid } = mountGrid({
      gap: 0,
      minCardWidth: 0
    });

    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('0px');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('0px');
  });

  it('supports percentage units for minCardWidth', () => {
    const { grid } = mountGrid({
      minCardWidth: '50%'
    });

    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('50%');
  });

  it('falls back to default CSS values when gap or minCardWidth is empty or whitespace', () => {
    const { grid } = mountGrid({
      gap: '',
      minCardWidth: '   '
    });

    // Empty/whitespace strings safely fall back to defaults, preventing broken CSS calc() in responsive mode
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('1rem');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('250px');
  });

  it('allows consumer style to override default CSS variables and verifies cascading precedence', () => {
    const { grid } = mountGrid({
      gap: '1rem',
      style: '--nui-card-gap: 2.5rem; color: red;'
    });

    // Effective CSS property value is determined by cascading precedence (later declaration wins)
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('2.5rem');
    expect(grid.style.getPropertyValue('color').trim()).toBe('red');
  });

  it('preserves consumer style when internal CSS variables are reactively recalculated', () => {
    const gapState = bindState<string | number>('1rem');

    const { grid } = mountGrid({
      get gap() {
        return gapState.current;
      },
      style: 'color: rgb(255, 0, 0); margin-top: 10px;'
    });

    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('1rem');
    expect(grid.style.getPropertyValue('color').trim()).toBe('rgb(255, 0, 0)');
    expect(grid.style.getPropertyValue('margin-top').trim()).toBe('10px');

    // Update gap
    gapState.current = '2.5rem';
    flushSync();

    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('2.5rem');
    expect(grid.style.getPropertyValue('color').trim()).toBe('rgb(255, 0, 0)');
    expect(grid.style.getPropertyValue('margin-top').trim()).toBe('10px');
  });

  it('reactively updates when consumer style prop changes', () => {
    const styleState = bindState('color: rgb(255, 0, 0);');

    const { grid } = mountGrid({
      get style() {
        return styleState.current;
      }
    });

    expect(grid.style.getPropertyValue('color').trim()).toBe('rgb(255, 0, 0)');

    // Reactively update consumer style
    styleState.current = 'color: rgb(0, 0, 255); font-size: 14px;';
    flushSync();

    expect(grid.style.getPropertyValue('color').trim()).toBe('rgb(0, 0, 255)');
    expect(grid.style.getPropertyValue('font-size').trim()).toBe('14px');
    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');
  });

  it('correctly parses consumer style when trailing semicolon is omitted', () => {
    const { grid } = mountGrid({
      style: 'color: blue'
    });

    expect(grid.style.getPropertyValue('color').trim()).toBe('blue');
    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('1rem');
  });

  it('handles style as undefined, null, or non-string object without throwing', () => {
    const { grid: undefGrid } = mountGrid({
      style: undefined
    });
    expect(undefGrid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');

    const { grid: nullGrid } = mountGrid({
      style: null as unknown as string
    });
    expect(nullGrid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');

    const { grid: objGrid } = mountGrid({
      style: { color: 'red' } as unknown as string
    });
    expect(objGrid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');
  });

  it('applies fixed layout modifier class nui-card-grid--fixed and omits responsive class when responsive is false', () => {
    const { grid } = mountGrid({
      columns: 2,
      responsive: false
    });

    expect(grid.classList.contains('nui-card-grid--fixed')).toBe(true);
    expect(grid.classList.contains('nui-card-grid--responsive')).toBe(false);
    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('2');
  });

  it('applies center modifier class only when center prop is true', () => {
    // 1. Default: no center class
    const { grid: defaultGrid } = mountGrid();
    expect(defaultGrid.classList.contains('nui-card-grid--center')).toBe(false);

    // 2. Explicit center: true
    const { grid: centeredGrid } = mountGrid({
      center: true
    });
    expect(centeredGrid.classList.contains('nui-card-grid--center')).toBe(true);
  });

  it.each([
    [0, '1'],
    [-3, '1'],
    [4.8, '4'],
    ['5', '5'],
    [Infinity, '1'],
    [-Infinity, '1'],
    [NaN, '1'],
    [undefined, '3'],
    [null, '3']
  ])('sanitizes columns=%s to %s', (input, expected) => {
    const { grid } = mountGrid({ columns: input as any });
    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe(expected);
  });

  it('reactively updates CSS variables and classes when bound props change', () => {
    const columnsState = bindState(3);
    const gapState = bindState<string | number>('1rem');
    const minWidthState = bindState<string | number>('250px');
    const responsiveState = bindState(true);
    const centerState = bindState(false);

    const { grid } = mountGrid({
      get columns() {
        return columnsState.current;
      },
      get gap() {
        return gapState.current;
      },
      get minCardWidth() {
        return minWidthState.current;
      },
      get responsive() {
        return responsiveState.current;
      },
      get center() {
        return centerState.current;
      }
    });

    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('3');
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('1rem');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('250px');
    expect(grid.classList.contains('nui-card-grid--responsive')).toBe(true);
    expect(grid.classList.contains('nui-card-grid--center')).toBe(false);

    // Reactively update all props
    columnsState.current = 6;
    gapState.current = 24;
    minWidthState.current = 320;
    responsiveState.current = false;
    centerState.current = true;
    flushSync();

    expect(grid.style.getPropertyValue('--nui-card-columns').trim()).toBe('6');
    expect(grid.style.getPropertyValue('--nui-card-gap').trim()).toBe('24px');
    expect(grid.style.getPropertyValue('--nui-card-min-width').trim()).toBe('320px');
    expect(grid.classList.contains('nui-card-grid--fixed')).toBe(true);
    expect(grid.classList.contains('nui-card-grid--responsive')).toBe(false);
    expect(grid.classList.contains('nui-card-grid--center')).toBe(true);
  });

  it('renders projected children snippet as a direct grid item', () => {
    const childrenSnippet = createRawSnippet(() => ({
      render: () => '<article class="test-card">Direct Card Item</article>'
    }));

    const { grid } = mountGrid({
      children: childrenSnippet
    });

    expect(grid.children.length).toBe(1);
    const card = grid.children[0];
    expect(card.classList.contains('test-card')).toBe(true);
    expect(card.textContent).toBe('Direct Card Item');
  });

  it('forwards custom classes and standard HTML attributes to the root element', () => {
    const { grid } = mountGrid({
      class: 'my-custom-grid layout-wide',
      id: 'main-grid',
      'data-testid': 'inventory-grid',
      role: 'region',
      'aria-label': 'Player Cards'
    });

    expect(grid.classList.contains('my-custom-grid')).toBe(true);
    expect(grid.classList.contains('layout-wide')).toBe(true);
    expect(grid.id).toBe('main-grid');
    expect(grid.getAttribute('data-testid')).toBe('inventory-grid');
    expect(grid.getAttribute('role')).toBe('region');
    expect(grid.getAttribute('aria-label')).toBe('Player Cards');
  });
});
