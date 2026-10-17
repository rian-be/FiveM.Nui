import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, unmount, createRawSnippet, type ComponentProps } from 'svelte';
import { flushSync, bindState } from '../helpers/testHelper.svelte';
import NuiStack from '../../src/components/layout/NuiStack.svelte';

type StackProps = ComponentProps<typeof NuiStack> & Record<string, unknown>;
type MountedComponent = ReturnType<typeof mount>;

describe('NuiStack', () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];

  function mountStack(props: StackProps = {}) {
    const target = document.createElement('div');
    container.appendChild(target);
    const inst = mount(NuiStack, {
      target,
      props: props as ComponentProps<typeof NuiStack>
    });
    mountedApps.push(inst);
    flushSync();
    const stack = target.querySelector<HTMLDivElement>('.nui-stack')!;
    return { stack, inst, target };
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

  it('renders with default column direction, stretch alignment, 0.5rem gap, and no flags', () => {
    const { stack } = mountStack();

    expect(stack).not.toBeNull();
    // Default direction
    expect(stack.classList.contains('nui-stack--column')).toBe(true);
    expect(stack.classList.contains('nui-stack--row')).toBe(false);
    expect(stack.classList.contains('nui-stack--row-reverse')).toBe(false);
    expect(stack.classList.contains('nui-stack--column-reverse')).toBe(false);

    // Default alignment
    expect(stack.classList.contains('nui-stack--align-stretch')).toBe(true);
    expect(stack.classList.contains('nui-stack--align-start')).toBe(false);
    expect(stack.classList.contains('nui-stack--align-center')).toBe(false);
    expect(stack.classList.contains('nui-stack--align-end')).toBe(false);
    expect(stack.classList.contains('nui-stack--align-baseline')).toBe(false);

    // Default modifier flags
    expect(stack.classList.contains('nui-stack--distribute')).toBe(false);
    expect(stack.classList.contains('nui-stack--wrap')).toBe(false);
    expect(stack.classList.contains('nui-stack--inline')).toBe(false);

    // Default gap
    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
  });

  it.each([
    'row',
    'column',
    'row-reverse',
    'column-reverse'
  ] as const)('applies exactly one direction class for direction=%s', (dir) => {
    const { stack } = mountStack({ direction: dir });
    const allDirections = ['row', 'column', 'row-reverse', 'column-reverse'];

    for (const d of allDirections) {
      if (d === dir) {
        expect(stack.classList.contains(`nui-stack--${d}`)).toBe(true);
      } else {
        expect(stack.classList.contains(`nui-stack--${d}`)).toBe(false);
      }
    }
  });

  it.each([
    'start',
    'center',
    'end',
    'stretch',
    'baseline'
  ] as const)('applies exactly one alignment class for align=%s', (alignment) => {
    const { stack } = mountStack({ align: alignment });
    const allAlignments = ['start', 'center', 'end', 'stretch', 'baseline'];

    for (const a of allAlignments) {
      if (a === alignment) {
        expect(stack.classList.contains(`nui-stack--align-${a}`)).toBe(true);
      } else {
        expect(stack.classList.contains(`nui-stack--align-${a}`)).toBe(false);
      }
    }
  });

  it('safely falls back to column direction and stretch alignment when invalid or null values are passed', () => {
    const { stack: invalidStack } = mountStack({
      direction: 'diagonal' as any,
      align: 'middle' as any
    });

    expect(invalidStack.classList.contains('nui-stack--column')).toBe(true);
    expect(invalidStack.classList.contains('nui-stack--diagonal')).toBe(false);
    expect(invalidStack.classList.contains('nui-stack--align-stretch')).toBe(true);
    expect(invalidStack.classList.contains('nui-stack--align-middle')).toBe(false);

    const { stack: nullStack } = mountStack({
      direction: null as any,
      align: null as any
    });

    expect(nullStack.classList.contains('nui-stack--column')).toBe(true);
    expect(nullStack.classList.contains('nui-stack--align-stretch')).toBe(true);
  });

  it.each([
    ['distribute', 'nui-stack--distribute'],
    ['wrap', 'nui-stack--wrap'],
    ['inline', 'nui-stack--inline']
  ] as const)('enables only the %s flag without setting others', (propName, className) => {
    const { stack } = mountStack({ [propName]: true });
    const flagClasses = [
      'nui-stack--distribute',
      'nui-stack--wrap',
      'nui-stack--inline'
    ];

    for (const cls of flagClasses) {
      if (cls === className) {
        expect(stack.classList.contains(cls)).toBe(true);
      } else {
        expect(stack.classList.contains(cls)).toBe(false);
      }
    }
  });

  it('supports distribute, wrap, and inline flags enabled together', () => {
    const { stack } = mountStack({
      distribute: true,
      wrap: true,
      inline: true
    });

    expect(stack.classList.contains('nui-stack--distribute')).toBe(true);
    expect(stack.classList.contains('nui-stack--wrap')).toBe(true);
    expect(stack.classList.contains('nui-stack--inline')).toBe(true);
  });

  it('converts number gap to px value including gap: 0', () => {
    const { stack: stack16 } = mountStack({ gap: 16 });
    expect(stack16.style.getPropertyValue('--nui-stack-gap').trim()).toBe('16px');

    const { stack: stack0 } = mountStack({ gap: 0 });
    expect(stack0.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0px');
  });

  it('supports string gap with units and falls back on empty or whitespace string', () => {
    const { stack: stack2rem } = mountStack({ gap: '2rem' });
    expect(stack2rem.style.getPropertyValue('--nui-stack-gap').trim()).toBe('2rem');

    const { stack: emptyStack } = mountStack({ gap: '' });
    expect(emptyStack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');

    const { stack: wsStack } = mountStack({ gap: '   ' });
    expect(wsStack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
  });

  it('allows consumer style to override default CSS variables and verifies cascading precedence', () => {
    const { stack } = mountStack({
      gap: '0.5rem',
      style: '--nui-stack-gap: 24px; color: blue;'
    });

    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('24px');
    expect(stack.style.getPropertyValue('color').trim()).toBe('blue');
  });

  it('preserves consumer style when gap is reactively updated', () => {
    const gapState = bindState<string | number>('0.5rem');

    const { stack } = mountStack({
      get gap() {
        return gapState.current;
      },
      style: 'color: rgb(0, 0, 255); margin: 8px;'
    });

    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
    expect(stack.style.getPropertyValue('color').trim()).toBe('rgb(0, 0, 255)');
    expect(stack.style.getPropertyValue('margin').trim()).toBe('8px');

    gapState.current = 20;
    flushSync();

    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('20px');
    expect(stack.style.getPropertyValue('color').trim()).toBe('rgb(0, 0, 255)');
    expect(stack.style.getPropertyValue('margin').trim()).toBe('8px');
  });

  it('reactively updates when consumer style prop changes', () => {
    const styleState = bindState('color: rgb(255, 0, 0);');

    const { stack } = mountStack({
      get style() {
        return styleState.current;
      }
    });

    expect(stack.style.getPropertyValue('color').trim()).toBe('rgb(255, 0, 0)');

    styleState.current = 'color: rgb(0, 128, 0); font-weight: bold;';
    flushSync();

    expect(stack.style.getPropertyValue('color').trim()).toBe('rgb(0, 128, 0)');
    expect(stack.style.getPropertyValue('font-weight').trim()).toBe('bold');
    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
  });

  it('correctly parses consumer style when trailing semicolon is omitted', () => {
    const { stack } = mountStack({
      style: 'color: green'
    });

    expect(stack.style.getPropertyValue('color').trim()).toBe('green');
    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
  });

  it('handles style as undefined, null, or non-string object without throwing', () => {
    const { stack: undefStack } = mountStack({
      style: undefined
    });
    expect(undefStack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');

    const { stack: nullStack } = mountStack({
      style: null as unknown as string
    });
    expect(nullStack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');

    const { stack: objStack } = mountStack({
      style: { color: 'red' } as unknown as string
    });
    expect(objStack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
  });

  it('renders projected children snippet as a direct stack item', () => {
    const childrenSnippet = createRawSnippet(() => ({
      render: () => '<span class="test-item">Direct Item</span>'
    }));

    const { stack } = mountStack({
      children: childrenSnippet
    });

    expect(stack.children.length).toBe(1);
    const item = stack.children[0];
    expect(item.classList.contains('test-item')).toBe(true);
    expect(item.textContent).toBe('Direct Item');
  });

  it('forwards custom classes and standard HTML attributes to the root element', () => {
    const { stack } = mountStack({
      class: 'custom-stack my-wrapper',
      id: 'settings-stack',
      'data-testid': 'action-stack',
      role: 'region',
      'aria-label': 'Settings Actions'
    });

    expect(stack.classList.contains('custom-stack')).toBe(true);
    expect(stack.classList.contains('my-wrapper')).toBe(true);
    expect(stack.id).toBe('settings-stack');
    expect(stack.getAttribute('data-testid')).toBe('action-stack');
    expect(stack.getAttribute('role')).toBe('region');
    expect(stack.getAttribute('aria-label')).toBe('Settings Actions');
  });

  it('reactively updates CSS variables and classes when bound props change', () => {
    const directionState = bindState<ComponentProps<typeof NuiStack>['direction']>('column');
    const alignState = bindState<ComponentProps<typeof NuiStack>['align']>('stretch');
    const gapState = bindState<string | number>('0.5rem');
    const distributeState = bindState(false);
    const wrapState = bindState(false);
    const inlineState = bindState(false);

    const { stack } = mountStack({
      get direction() {
        return directionState.current;
      },
      get align() {
        return alignState.current;
      },
      get gap() {
        return gapState.current;
      },
      get distribute() {
        return distributeState.current;
      },
      get wrap() {
        return wrapState.current;
      },
      get inline() {
        return inlineState.current;
      }
    });

    expect(stack.classList.contains('nui-stack--column')).toBe(true);
    expect(stack.classList.contains('nui-stack--align-stretch')).toBe(true);
    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('0.5rem');
    expect(stack.classList.contains('nui-stack--distribute')).toBe(false);
    expect(stack.classList.contains('nui-stack--wrap')).toBe(false);
    expect(stack.classList.contains('nui-stack--inline')).toBe(false);

    // Reactively update all props
    directionState.current = 'row-reverse';
    alignState.current = 'center';
    gapState.current = 16;
    distributeState.current = true;
    wrapState.current = true;
    inlineState.current = true;
    flushSync();

    expect(stack.classList.contains('nui-stack--row-reverse')).toBe(true);
    expect(stack.classList.contains('nui-stack--column')).toBe(false);
    expect(stack.classList.contains('nui-stack--align-center')).toBe(true);
    expect(stack.classList.contains('nui-stack--align-stretch')).toBe(false);
    expect(stack.style.getPropertyValue('--nui-stack-gap').trim()).toBe('16px');
    expect(stack.classList.contains('nui-stack--distribute')).toBe(true);
    expect(stack.classList.contains('nui-stack--wrap')).toBe(true);
    expect(stack.classList.contains('nui-stack--inline')).toBe(true);
  });
});
