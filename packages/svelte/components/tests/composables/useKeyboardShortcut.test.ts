import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import {
  type KeyboardShortcut,
  type KeyboardShortcutOptions,
  type KeyboardShortcutsSource,
  type KeyboardShortcutSource
} from '../../src/composables/useKeyboardShortcut.svelte';
import KeyboardShortcutHost from '../helpers/KeyboardShortcutHost.svelte';

type MountedComponent = ReturnType<typeof mount>;

describe('useKeyboardShortcut & useKeyboardShortcuts composables', () => {
  let container: HTMLElement;
  let mountedApps: MountedComponent[] = [];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    while (mountedApps.length > 0) {
      const app = mountedApps.pop()!;
      unmount(app);
    }
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function registerShortcuts(
    shortcuts: KeyboardShortcutsSource,
    options?: KeyboardShortcutOptions
  ) {
    const app = mount(KeyboardShortcutHost, {
      target: container,
      props: { shortcuts, options }
    });
    mountedApps.push(app);
    flushSync();
    return () => {
      const idx = mountedApps.indexOf(app);
      if (idx !== -1) {
        mountedApps.splice(idx, 1);
      }
      unmount(app);
    };
  }

  function registerSingleShortcut(
    singleShortcut: KeyboardShortcutSource,
    options?: KeyboardShortcutOptions
  ) {
    const app = mount(KeyboardShortcutHost, {
      target: container,
      props: { singleShortcut, options }
    });
    mountedApps.push(app);
    flushSync();
    return () => {
      const idx = mountedApps.indexOf(app);
      if (idx !== -1) {
        mountedApps.splice(idx, 1);
      }
      unmount(app);
    };
  }

  describe('key and code matching', () => {
    it('triggers callback when key matches case-insensitively', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'e', callback }]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(2);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('matches physical key code and overrides key when code is provided', () => {
      const callback = vi.fn();

      // When code is provided, key ('a') must be completely ignored in favor of code ('KeyB')
      registerShortcuts([{ key: 'a', code: 'KeyB', callback }]);

      // Matching key 'a' with wrong code 'KeyA' -> should NOT trigger
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Matching code 'KeyB' with arbitrary key -> triggers
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles layout-independent key codes like Shift+1 with Digit1', () => {
      const callback = vi.fn();
      registerShortcuts([{ code: 'Digit1', shift: true, callback }]);

      // On some keyboards Shift+1 produces key: '!' but code is always 'Digit1'
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '!', code: 'Digit1', shiftKey: true, bubbles: true })
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports Space key matching via key: " " or code: "Space"', () => {
      const callbackKey = vi.fn();
      const callbackCode = vi.fn();

      registerShortcuts([{ key: ' ', callback: callbackKey }]);
      registerShortcuts([{ code: 'Space', callback: callbackCode }]);

      // Standard browser Space produces key: ' ' and code: 'Space'
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      expect(callbackKey).toHaveBeenCalledTimes(1);
      expect(callbackCode).toHaveBeenCalledTimes(1);
    });

    it('supports deprecated event alias and prioritizes key over event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      registerShortcuts([
        { event: 'Escape', callback: callback1 },
        { key: 'Enter', event: ' ', callback: callback2 }
      ]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(callback1).toHaveBeenCalledTimes(1);

      // 'Enter' (key) takes precedence over ' ' (event)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(callback2).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(callback2).toHaveBeenCalledTimes(1); // unchanged
    });

    it('does not match when key or code is empty string or undefined', () => {
      const callbackEmpty = vi.fn();
      const callbackUndefined = vi.fn();
      registerShortcuts([{ key: '', callback: callbackEmpty }, { callback: callbackUndefined }]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(callbackEmpty).not.toHaveBeenCalled();
      expect(callbackUndefined).not.toHaveBeenCalled();
    });
  });

  describe('evaluation order and composition protection', () => {
    it('stops evaluation after first matching shortcut (break behavior)', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      registerShortcuts([
        { key: 'Escape', callback: callback1 },
        { key: 'Escape', callback: callback2 }
      ]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it('ignores events during active IME composition (event.isComposing = true)', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'Enter', callback }]);

      // In happy-dom / jsdom, KeyboardEvent supports isComposing from KeyboardEventInit
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
      );
      expect(callback).not.toHaveBeenCalled();

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', isComposing: false, bubbles: true })
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('modifiers and exact matching', () => {
    it('matches FiveM Windows CEF modifiers: ctrl and mod as primary modifier', () => {
      const callbackCtrl = vi.fn();
      const callbackMod = vi.fn();

      registerShortcuts([
        { key: 's', ctrl: true, callback: callbackCtrl },
        { key: 'o', mod: true, callback: callbackMod }
      ]);

      // Without Ctrl
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
      expect(callbackCtrl).not.toHaveBeenCalled();

      // With Ctrl
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
      expect(callbackCtrl).toHaveBeenCalledTimes(1);

      // With mod (equivalent to Ctrl in Windows CEF)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true }));
      expect(callbackMod).toHaveBeenCalledTimes(1);
    });

    it('gives ctrl precedence over mod when both are defined', () => {
      const callback = vi.fn();

      // ctrl: false overrides mod: true
      registerShortcuts([{ key: 'z', ctrl: false, mod: true, callback }]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: false, bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('enforces exact matching when ctrl: false and mod: true conflict', () => {
      const callback = vi.fn();
      // ctrl: false overrides mod: true, and exact: true requires no other modifiers
      registerShortcuts([{ key: 'k', ctrl: false, mod: true, exact: true, callback }]);

      // Pressing with Ctrl fails because ctrl: false takes precedence
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Pressing without any modifiers succeeds
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: false,
          altKey: false,
          shiftKey: false,
          metaKey: false,
          bubbles: true
        })
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('matches Alt, Shift, and Meta modifiers', () => {
      const callbackAlt = vi.fn();
      const callbackShift = vi.fn();
      const callbackMeta = vi.fn();

      registerShortcuts([
        { key: 'Tab', alt: true, callback: callbackAlt },
        { key: '?', shift: true, callback: callbackShift },
        { key: 'm', meta: true, callback: callbackMeta }
      ]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', altKey: true, bubbles: true }));
      expect(callbackAlt).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }));
      expect(callbackShift).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', metaKey: true, bubbles: true }));
      expect(callbackMeta).toHaveBeenCalledTimes(1);
    });

    it('enforces exact: true without modifiers (blocks extra modifiers like Ctrl)', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'e', exact: true, callback }]);

      // Extra Ctrl pressed -> should fail exact check
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // No modifiers -> succeeds
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'e',
          ctrlKey: false,
          altKey: false,
          shiftKey: false,
          metaKey: false,
          bubbles: true
        })
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('enforces exact: true with modifiers', () => {
      const callbackExact = vi.fn();
      const callbackPermissive = vi.fn();

      registerShortcuts([
        { key: 'k', ctrl: true, exact: true, callback: callbackExact },
        { key: 'j', ctrl: true, exact: false, callback: callbackPermissive }
      ]);

      // Pressing Ctrl+Shift+K fails exact (Shift was not requested)
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: true, bubbles: true })
      );
      expect(callbackExact).not.toHaveBeenCalled();

      // Pressing strictly Ctrl+K succeeds
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, shiftKey: false, bubbles: true })
      );
      expect(callbackExact).toHaveBeenCalledTimes(1);

      // Permissive allows extra modifiers like Shift
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, shiftKey: true, bubbles: true })
      );
      expect(callbackPermissive).toHaveBeenCalledTimes(1);
    });
  });

  describe('event propagation and default behavior', () => {
    it('calls preventDefault by default (preventDefault: true) and sets defaultPrevented', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'p', callback }]);

      const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('does not call preventDefault when preventDefault: false is configured', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'p', preventDefault: false, callback }]);

      const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      window.dispatchEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(preventDefaultSpy).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('calls stopPropagation when stopPropagation: true', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 's', stopPropagation: true, callback }]);

      const event = new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      window.dispatchEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
    });

    it('calls stopImmediatePropagation when stopImmediatePropagation: true', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'i', stopImmediatePropagation: true, callback }]);

      const event = new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true });
      const stopImmediateSpy = vi.spyOn(event, 'stopImmediatePropagation');

      window.dispatchEvent(event);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(stopImmediateSpy).toHaveBeenCalledTimes(1);
    });

    it('supports capture: true to intercept events during capture phase, contrasting with bubbling phase', () => {
      const targetEl = document.createElement('div');
      const childEl = document.createElement('button');
      targetEl.appendChild(childEl);
      document.body.appendChild(targetEl);

      // Child element stops propagation in bubbling phase
      childEl.addEventListener('keydown', (e) => {
        e.stopPropagation();
      });

      // 1. Control case: with capture: false, childEl stopping propagation blocks targetEl
      const callbackBubbling = vi.fn();
      const cleanupBubbling = registerShortcuts([{ key: 'c', callback: callbackBubbling }], {
        target: targetEl,
        capture: false
      });

      childEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
      expect(callbackBubbling).not.toHaveBeenCalled();
      cleanupBubbling();

      // 2. Active case: with capture: true, targetEl receives event during capture phase BEFORE childEl bubbling handler
      const callbackCapture = vi.fn();
      const cleanupCapture = registerShortcuts([{ key: 'c', callback: callbackCapture }], {
        target: targetEl,
        capture: true
      });

      childEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
      expect(callbackCapture).toHaveBeenCalledTimes(1);
      cleanupCapture();
    });
  });

  describe('ignoreInputs behavior', () => {
    it('suppresses shortcuts when native input, textarea, or select is focused', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'e', callback, ignoreInputs: true }]);

      const input = document.createElement('input');
      const textarea = document.createElement('textarea');
      const select = document.createElement('select');
      document.body.append(input, textarea, select);

      input.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      textarea.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      select.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      select.blur();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('suppresses shortcuts when composedPath()[0] is an input inside Shadow DOM', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'e', callback, ignoreInputs: true }]);

      const host = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const shadowInput = document.createElement('input');
      shadowRoot.appendChild(shadowInput);
      document.body.appendChild(host);

      // Event originating from inside shadow root has composedPath()[0] as shadowInput
      shadowInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, composed: true }));
      expect(callback).not.toHaveBeenCalled();
    });

    it('suppresses shortcuts on elements inside contenteditable containers', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'e', callback, ignoreInputs: true }]);

      // In happy-dom/jsdom, isContentEditable is not always implemented on child nodes,
      // so this relies on el.closest('[contenteditable]:not([contenteditable="false"])')
      const containerEl = document.createElement('div');
      containerEl.setAttribute('contenteditable', 'true');
      const paragraph = document.createElement('p');
      paragraph.tabIndex = 0;
      containerEl.appendChild(paragraph);
      document.body.appendChild(containerEl);

      paragraph.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();
    });

    it('suppresses shortcuts on ARIA textbox and searchbox roles', () => {
      const callback = vi.fn();
      registerShortcuts([{ key: 'e', callback, ignoreInputs: true }]);

      const customInput = document.createElement('div');
      customInput.tabIndex = 0;
      customInput.setAttribute('role', 'textbox');
      document.body.appendChild(customInput);

      customInput.focus();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('repeat, enabled, and lazy getters', () => {
    it('respects ignoreRepeat with code: "Space"', () => {
      const callback = vi.fn();
      registerShortcuts([{ code: 'Space', callback, ignoreRepeat: true }]);

      // Repeated keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: true, bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Initial non-repeated keydown
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', repeat: false, bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('respects static boolean enabled flag', () => {
      const callbackDisabled = vi.fn();
      const callbackEnabled = vi.fn();

      registerShortcuts([
        { key: '1', callback: callbackDisabled, enabled: false },
        { key: '2', callback: callbackEnabled, enabled: true }
      ]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      expect(callbackDisabled).not.toHaveBeenCalled();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      expect(callbackEnabled).toHaveBeenCalledTimes(1);
    });

    it('evaluates dynamic enabled getter on each keydown event', () => {
      const callback = vi.fn();
      let isEnabled = false;

      registerShortcuts([{ key: 'Escape', callback, enabled: () => isEnabled }]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      isEnabled = true;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('evaluates lazy shortcut list getter on each keydown event', () => {
      const callbackA = vi.fn();
      const callbackB = vi.fn();

      let currentList: KeyboardShortcut[] = [{ key: 'a', callback: callbackA }];
      registerShortcuts(() => currentList);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(callbackA).toHaveBeenCalledTimes(1);

      // Mutate list
      currentList = [{ key: 'b', callback: callbackB }];

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(callbackA).toHaveBeenCalledTimes(1); // unchanged

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true }));
      expect(callbackB).toHaveBeenCalledTimes(1);
    });

    it('evaluates lazy single shortcut getter on each keydown event via useKeyboardShortcut', () => {
      const callbackA = vi.fn();
      const callbackB = vi.fn();

      let currentShortcut: KeyboardShortcut = { key: '1', callback: callbackA };
      registerSingleShortcut(() => currentShortcut);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      expect(callbackA).toHaveBeenCalledTimes(1);

      currentShortcut = { key: '2', callback: callbackB };

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      expect(callbackA).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true }));
      expect(callbackB).toHaveBeenCalledTimes(1);
    });
  });

  describe('targets, errors, and unmount lifecycle', () => {
    it('supports custom target element and target getter', () => {
      const targetEl = document.createElement('div');
      document.body.appendChild(targetEl);

      const callback = vi.fn();
      registerShortcuts([{ key: 'Enter', callback }], { target: () => targetEl });

      // Window event should not trigger targetEl listener
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(callback).not.toHaveBeenCalled();

      // Target element event triggers
      targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles callback errors safely without crashing and logs with [nui-keyboard] prefix', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
      const faultyCallback = vi.fn(() => {
        throw new Error('Callback failed');
      });

      registerShortcuts([{ key: 'F1', callback: faultyCallback }]);

      expect(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
      }).not.toThrow();

      expect(faultyCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[nui-keyboard] Error in shortcut callback:',
        expect.any(Error)
      );
    });

    it('cleans up event listeners when component is unmounted', () => {
      const callback = vi.fn();
      const cleanup = registerShortcuts([{ key: 'x', callback }]);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);

      cleanup();

      // Subsequent keydowns should NOT trigger callback
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
