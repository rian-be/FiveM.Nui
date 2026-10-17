import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  clickOutsideAction,
  type ClickOutsideOptions
} from '../../src/composables/useClickOutside';
import ClickOutsideHost from '../helpers/ClickOutsideHost.svelte';

describe('useClickOutside & clickOutsideAction composables', () => {
  let container: HTMLElement;
  let targetEl: HTMLElement;
  let outsideEl: HTMLElement;
  let ignoreEl: HTMLElement;
  let mountedApps: Array<Record<string, any>> = [];

  beforeEach(() => {
    container = document.createElement('div');
    targetEl = document.createElement('div');
    targetEl.id = 'target-panel';

    outsideEl = document.createElement('div');
    outsideEl.id = 'outside-content';

    ignoreEl = document.createElement('button');
    ignoreEl.id = 'ignore-toggle-btn';

    document.body.appendChild(container);
    document.body.appendChild(targetEl);
    document.body.appendChild(outsideEl);
    document.body.appendChild(ignoreEl);
  });

  afterEach(() => {
    for (const app of mountedApps) {
      try {
        unmount(app);
      } catch {
        // App might have already been unmounted in the test
      }
    }
    mountedApps = [];

    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('clickOutsideAction', () => {
    it('invokes callback when pointerdown occurs outside the target element', () => {
      const callback = vi.fn();
      const action = clickOutsideAction(targetEl, callback);

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(PointerEvent));

      action.destroy();
    });

    it('does not invoke callback when pointerdown occurs inside targetEl or its descendants', () => {
      const callback = vi.fn();
      const childEl = document.createElement('span');
      childEl.id = 'target-child';
      targetEl.appendChild(childEl);

      const action = clickOutsideAction(targetEl, callback);

      // 1. Direct click on target element
      targetEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // 2. Click on child inside target element
      childEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      action.destroy();
    });

    it('respects static enabled: false option', () => {
      const callback = vi.fn();
      const action = clickOutsideAction(targetEl, { callback, enabled: false });

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      action.destroy();
    });

    it('respects dynamic getter enabled: () => boolean', () => {
      const callback = vi.fn();
      let isEnabled = false;

      const action = clickOutsideAction(targetEl, {
        callback,
        enabled: () => isEnabled
      });

      // Initially disabled
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Dynamically enable
      isEnabled = true;
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      action.destroy();
    });

    it('respects ignore targets and clicks inside ignored child elements', () => {
      const callback = vi.fn();
      const ignoreChildEl = document.createElement('span');
      ignoreChildEl.id = 'ignore-icon';
      ignoreEl.appendChild(ignoreChildEl);

      const options: ClickOutsideOptions = {
        callback,
        ignore: [ignoreEl]
      };

      const action = clickOutsideAction(targetEl, options);

      // Click directly on ignored button
      ignoreEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Click on child inside ignored button
      ignoreChildEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Click on unignored outside element
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      action.destroy();
    });

    it('supports update() to swap callback function', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const action = clickOutsideAction(targetEl, callback1);

      action.update(callback2);

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);

      action.destroy();
    });

    it('supports update() to reconfigure options (e.g. disabling)', () => {
      const callback = vi.fn();
      const action = clickOutsideAction(targetEl, { callback, enabled: true });

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      // Disable via update
      action.update({ callback, enabled: false });

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1); // Call count unchanged

      action.destroy();
    });

    it('completely unbinds listeners after destroy()', () => {
      const callback = vi.fn();
      const action = clickOutsideAction(targetEl, callback);

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      action.destroy();

      // Subsequent clicks should be ignored
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('useClickOutside composable', () => {
    it('invokes 1-argument callback (event) => void on outside click and not on inside click', () => {
      const callback = vi.fn();

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: (e: MouseEvent | TouchEvent | PointerEvent) => {
            callback(e);
          }
        }
      });
      mountedApps.push(app);
      flushSync();

      // Inside click -> no invocation
      targetEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Outside click -> invoked with PointerEvent
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(PointerEvent));
    });

    it('invokes 0-argument callback () => void on outside click', () => {
      const callback = vi.fn();

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: () => {
            callback();
          }
        }
      });
      mountedApps.push(app);
      flushSync();

      targetEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports rest parameter callbacks (...args) without breaking options resolution', () => {
      const callback = vi.fn();

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: (...args: unknown[]) => {
            callback(...args);
          }
        }
      });
      mountedApps.push(app);
      flushSync();

      targetEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports default parameter callbacks (e = null) without premature invocation during init', () => {
      const callback = vi.fn();

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: (e = null) => {
            callback(e);
          }
        }
      });
      mountedApps.push(app);
      flushSync();

      // Crucial: Must NOT be called during option detection/initialization
      expect(callback).not.toHaveBeenCalled();

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('respects static options object with ignore targets', () => {
      const callback = vi.fn();

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: {
            callback,
            ignore: [ignoreEl]
          }
        }
      });
      mountedApps.push(app);
      flushSync();

      // Click on ignored element
      ignoreEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Click on outside element
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('respects reactive options getter with dynamic enabled state', () => {
      const callback = vi.fn();
      let isEnabled = false;

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: () => ({
            callback,
            enabled: () => isEnabled
          })
        }
      });
      mountedApps.push(app);
      flushSync();

      // Initially disabled
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Dynamically enable
      isEnabled = true;
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('cleans up listeners on component unmount', () => {
      const callback = vi.fn();

      const app = mount(ClickOutsideHost, {
        target: container,
        props: {
          targetEl: () => targetEl,
          options: callback
        }
      });
      flushSync();

      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      unmount(app);

      // Subsequent clicks should NOT invoke the callback
      outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
