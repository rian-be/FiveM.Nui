import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import TestHost from '../helpers/TestHost.svelte';
import { SvelteNuiClient } from '../../src/client';
import { setDefaultNuiClient, resetDefaultNuiClient } from '../../src/context';
import { resetLayerStack, getLayerStack } from '../../src/actions/layer';

describe('Rune composables ($effect.root lifecycle)', () => {
  let container: HTMLElement;
  let client: SvelteNuiClient;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    client = new SvelteNuiClient({ autoInitialize: false });
    setDefaultNuiClient(client);
  });

  afterEach(() => {
    client.destroy();
    resetDefaultNuiClient();
    resetLayerStack();
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('useEscape composable with target: window and cleans up on unmount', () => {
    const onEscapeWindow = vi.fn();

    const app = mount(TestHost, {
      target: container,
      props: {
        escapeOptions: () => ({ target: 'window', onEscape: onEscapeWindow })
      }
    });
    flushSync();

    const winEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(winEvent);
    expect(onEscapeWindow).toHaveBeenCalledTimes(1);

    unmount(app);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onEscapeWindow).toHaveBeenCalledTimes(1);
  });

  it('useClickOutside composable handles null target and valid element dismiss', () => {
    const onOutside = vi.fn();

    // First test with null target: does not attach listener or crash
    const appWithNull = mount(TestHost, {
      target: container,
      props: {
        clickOutsideTarget: () => null,
        clickOutsideOptions: () => ({ onClickOutside: onOutside })
      }
    });
    flushSync();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onOutside).not.toHaveBeenCalled();
    unmount(appWithNull);

    // Next test with valid container target
    const app = mount(TestHost, {
      target: container,
      props: {
        clickOutsideOptions: () => ({ onClickOutside: onOutside })
      }
    });
    flushSync();

    const hostBtn = container.querySelector<HTMLElement>('#hostBtn')!;

    // Click inside: no dismiss
    hostBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onOutside).not.toHaveBeenCalled();

    // Click outside on document.body: triggers
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    expect(onOutside).toHaveBeenCalledTimes(1);

    unmount(app);
  });

  it('useFocusTrap composable handles null target, element trap, dynamic options, and unmount cleanup', async () => {
    // Null target test
    const appWithNull = mount(TestHost, {
      target: container,
      props: {
        trapTarget: () => null,
        trapOptions: () => ({ enabled: true })
      }
    });
    flushSync();
    unmount(appWithNull);

    // Valid target
    let enabled = true;
    const app = mount(TestHost, {
      target: container,
      props: {
        trapOptions: () => ({ enabled })
      }
    });
    flushSync();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const btn = container.querySelector<HTMLElement>('#hostBtn')!;
    expect(document.activeElement).toBe(btn);

    // Dynamically update options
    enabled = false;
    flushSync();

    unmount(app);
  });

  it('does not invoke onDismiss callback upon mount or initialization', () => {
    let isOpen = true;
    const onDismiss = vi.fn(() => {
      isOpen = false;
    });

    const app = mount(TestHost, {
      target: container,
      props: {
        layerOptions: () => ({
          id: 'mount-layer',
          enabled: isOpen,
          onDismiss
        })
      }
    });
    flushSync();

    expect(onDismiss).not.toHaveBeenCalled();
    expect(isOpen).toBe(true);
    expect(getLayerStack().some((l) => l.id === 'mount-layer')).toBe(true);

    unmount(app);
  });

  it('toggling enabled activates and deactivates layer', () => {
    const controller: Record<string, any> = {};
    const app = mount(TestHost, {
      target: container,
      props: {
        controller,
        layerOptions: () => ({
          id: 'toggle-layer',
          enabled: false
        })
      }
    });
    flushSync();
    expect(getLayerStack().some((l) => l.id === 'toggle-layer')).toBe(false);

    // Toggle on
    controller.setLayerEnabled(true);
    flushSync();
    expect(getLayerStack().some((l) => l.id === 'toggle-layer')).toBe(true);

    // Toggle off
    controller.setLayerEnabled(false);
    flushSync();
    expect(getLayerStack().some((l) => l.id === 'toggle-layer')).toBe(false);

    unmount(app);
  });

  it('handles target element appearing later and cleans up on unmount', () => {
    const controller: Record<string, any> = {};
    const app = mount(TestHost, {
      target: container,
      props: {
        controller,
        layerTarget: () => null,
        layerOptions: () => ({ id: 'delayed-layer', enabled: true })
      }
    });
    flushSync();
    expect(getLayerStack().some((l) => l.id === 'delayed-layer')).toBe(false);

    // Element appears later
    const dynamicNode = document.createElement('div');
    container.appendChild(dynamicNode);
    controller.setLayerTarget(dynamicNode);
    flushSync();
    expect(getLayerStack().some((l) => l.id === 'delayed-layer')).toBe(true);

    // Unmount
    unmount(app);
    expect(getLayerStack().some((l) => l.id === 'delayed-layer')).toBe(false);
  });

  it('handles two nested layers coordinating topmost escape dismissal', () => {
    const onParentDismiss = vi.fn();
    const onChildDismiss = vi.fn();

    const parentApp = mount(TestHost, {
      target: container,
      props: {
        layerOptions: () => ({
          id: 'parent-layer',
          enabled: true,
          onDismiss: onParentDismiss
        })
      }
    });

    const childApp = mount(TestHost, {
      target: container,
      props: {
        layerOptions: () => ({
          id: 'child-layer',
          enabled: true,
          onDismiss: onChildDismiss
        })
      }
    });
    flushSync();

    const stack = getLayerStack();
    expect(stack.some((l) => l.id === 'parent-layer')).toBe(true);
    expect(stack.some((l) => l.id === 'child-layer')).toBe(true);

    // First Escape -> only topmost child layer dismisses
    const escape1 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape1);
    expect(onChildDismiss).toHaveBeenCalledWith('escape');
    expect(onParentDismiss).not.toHaveBeenCalled();

    // Child closes / unmounts
    unmount(childApp);
    expect(getLayerStack().some((l) => l.id === 'child-layer')).toBe(false);
    expect(getLayerStack().some((l) => l.id === 'parent-layer')).toBe(true);

    // Second Escape -> parent layer now dismisses
    const escape2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(escape2);
    expect(onParentDismiss).toHaveBeenCalledWith('escape');

    unmount(parentApp);
    expect(getLayerStack().some((l) => l.id === 'parent-layer')).toBe(false);
  });

  it('instantiates and cleans up useNuiState, useNuiQuery, useNuiWindow via onDestroy in component lifecycle', () => {
    const exposed: Record<string, any> = {};
    const app = mount(TestHost, {
      target: container,
      props: {
        mountLifecycleRunes: true,
        exposed
      }
    });
    flushSync();

    expect(exposed.state.value).toBe(1);
    expect(exposed.query.loading).toBe(false);
    expect(exposed.win.visible).toBe(false);

    // Active in component before unmount
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'lifecycle:state', payload: 2 }
      })
    );
    expect(exposed.state.value).toBe(2);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'open', event: 'lifecycle:win' }
      })
    );
    expect(exposed.win.visible).toBe(true);

    // Unmount -> triggers component lifecycle cleanup (onDestroy)
    unmount(app);

    // Dispatches after unmount must NOT update state or window
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'event', event: 'lifecycle:state', payload: 99 }
      })
    );
    expect(exposed.state.value).toBe(2);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'close', event: 'lifecycle:win' }
      })
    );
    expect(exposed.win.visible).toBe(true); // was true when unmounted, not modified
  });
});

