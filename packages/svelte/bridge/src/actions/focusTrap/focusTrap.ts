import type { Action } from 'svelte/action';
import {
  getFocusables,
  resolveInitialElement,
  handleTabKey
} from './focusables';
import {
  type FocusTrapEntry,
  getTopTrap,
  isNodeAllowedOutside,
  pushTrap,
  removeTrap
} from './trapStack';
import {
  type NuiFocusTrapInput,
  toFocusTrapOptions
} from './types';

/**
 * Svelte Action for trapping Tab key navigation inside an element.
 *
 * Essential in FiveM NUI to prevent keyboard navigation from leaking out of CEF
 * modals or into the background game window.
 *
 * @param node - The container DOM element confining focus.
 * @param parameter - Configuration options or boolean enabled flag.
 *
 * @example
 * ```svelte
 * <div class="modal" use:nuiFocusTrap={isOpen}>...</div>
 * <div class="dialog" use:nuiFocusTrap={{ enabled: true, allowOutside: '.datepicker-portal' }}>...</div>
 * ```
 */
export const nuiFocusTrap: Action<HTMLElement, NuiFocusTrapInput> = (
  node,
  parameter
) => {
  let currentParam = parameter;
  let active = false;
  let previouslyFocused: HTMLElement | null = null;
  let rafId: number | null = null;
  let controller: AbortController | null = null;
  let addedTabindex = false;

  function isEnabled(): boolean {
    const opts = toFocusTrapOptions(currentParam);
    const { enabled } = opts;
    return typeof enabled === 'function' ? enabled() : (enabled ?? true);
  }

  function containsOrAllowed(target: Node | null): boolean {
    if (!target) return false;
    if (node.contains(target)) return true;
    const opts = toFocusTrapOptions(currentParam);
    return isNodeAllowedOutside(target, opts.allowOutside);
  }

  function focusFirst() {
    if (!active || !node.isConnected) return;

    const focusables = getFocusables(node);
    if (focusables.length > 0) {
      if (addedTabindex) {
        node.removeAttribute('tabindex');
        addedTabindex = false;
      }
      focusables[0].focus();
    } else {
      if (!node.hasAttribute('tabindex')) {
        node.setAttribute('tabindex', '-1');
        addedTabindex = true;
      }
      node.focus();
    }
  }

  function focusInitial() {
    if (!active || !node.isConnected) return;

    const opts = toFocusTrapOptions(currentParam);
    if (opts.autofocus === false) return;

    const targetEl = resolveInitialElement(node, opts.initialFocus);
    if (
      targetEl &&
      targetEl.isConnected &&
      (node.contains(targetEl) || isNodeAllowedOutside(targetEl, opts.allowOutside))
    ) {
      if (addedTabindex) {
        node.removeAttribute('tabindex');
        addedTabindex = false;
      }
      targetEl.focus();
      return;
    }

    if (!containsOrAllowed(document.activeElement)) {
      focusFirst();
    }
  }

  function checkIsTopmost(): boolean {
    const opts = toFocusTrapOptions(currentParam);
    if (typeof opts.isTopmost === 'function') {
      return opts.isTopmost();
    }
    return getTopTrap()?.node === node;
  }

  function onFocusIn(event: FocusEvent) {
    if (!active || !node.isConnected) return;
    if (!checkIsTopmost()) return;

    const target = event.target as Node | null;
    if (!target || containsOrAllowed(target)) return;

    focusFirst();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!active || !checkIsTopmost()) return;
    const opts = toFocusTrapOptions(currentParam);
    handleTabKey(event, node, opts.allowOutside, focusFirst);
  }

  function restoreFocus() {
    const opts = toFocusTrapOptions(currentParam);
    if (opts.returnFocus === false) return;

    if (opts.returnFocus instanceof HTMLElement && opts.returnFocus.isConnected) {
      opts.returnFocus.focus();
    } else if (previouslyFocused && previouslyFocused.isConnected) {
      previouslyFocused.focus();
    }

    const topEntry = getTopTrap();
    if (topEntry && !topEntry.containsOrAllowed(document.activeElement)) {
      topEntry.focusFirst();
    }
  }

  function teardown() {
    if (rafId !== null) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafId);
      }
      rafId = null;
    }
    if (controller) {
      controller.abort();
      controller = null;
    }
    removeTrap(node);
  }

  const entry: FocusTrapEntry = {
    node,
    focusFirst,
    containsOrAllowed,
    isTopmost: () => {
      const opts = toFocusTrapOptions(currentParam);
      return typeof opts.isTopmost === 'function' ? opts.isTopmost() : undefined;
    }
  };

  function setup() {
    teardown();
    if (!isEnabled()) return;

    previouslyFocused = document.activeElement as HTMLElement | null;
    if (previouslyFocused && node.contains(previouslyFocused)) {
      previouslyFocused = null;
    }
    active = true;
    pushTrap(entry);
    controller = new AbortController();

    document.addEventListener('keydown', onKeyDown, { capture: true, signal: controller.signal });
    document.addEventListener('focusin', onFocusIn, { signal: controller.signal });

    if (typeof requestAnimationFrame !== 'undefined') {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (active && node.isConnected) {
          focusInitial();
        }
      });
    } else if (typeof queueMicrotask !== 'undefined') {
      queueMicrotask(() => {
        if (active && node.isConnected) {
          focusInitial();
        }
      });
    }
  }

  function deactivate() {
    const wasActive = active;
    active = false;
    teardown();
    if (addedTabindex) {
      node.removeAttribute('tabindex');
      addedTabindex = false;
    }
    if (wasActive) {
      restoreFocus();
    }
  }

  setup();

  return {
    update(newParam) {
      const wasEnabled = active;
      currentParam = newParam;
      const nowEnabled = isEnabled();

      if (!wasEnabled && nowEnabled) {
        setup();
      } else if (wasEnabled && !nowEnabled) {
        deactivate();
      }
    },
    destroy() {
      deactivate();
    }
  };
};
