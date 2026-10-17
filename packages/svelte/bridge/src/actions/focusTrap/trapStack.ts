export type FocusTrapAllowOutsideTarget =
  | Element
  | string
  | null
  | undefined
  | (() => Element | null | undefined);

export type FocusTrapAllowOutside =
  | FocusTrapAllowOutsideTarget
  | FocusTrapAllowOutsideTarget[];

export interface FocusTrapEntry {
  node: HTMLElement;
  focusFirst: () => void;
  containsOrAllowed: (el: Node | null) => boolean;
  isTopmost?: () => boolean | undefined;
}

/**
 * Global stack of active focus trap entries.
 * Ensures only the topmost trap (e.g. child confirmation dialog or portaled modal)
 * enforces focus containment, preventing nested traps from fighting for focus.
 */
const trapStack: FocusTrapEntry[] = [];

/**
 * Registers an active focus trap entry to the top of the trap stack.
 */
export function pushTrap(entry: FocusTrapEntry): void {
  trapStack.push(entry);
}

/**
 * Removes a focus trap entry associated with the given container node.
 */
export function removeTrap(node: HTMLElement): void {
  const idx = trapStack.findIndex((e) => e.node === node);
  if (idx !== -1) {
    trapStack.splice(idx, 1);
  }
}

/**
 * Resolves the topmost active focus trap entry.
 * Evaluates custom `isTopmost` predicates first (e.g. from `nuiLayer`), where layer-managed
 * traps with `isTopmost: true` always take precedence over standalone traps.
 * Falls back to activation order (most recently activated connected trap).
 */
export function getTopTrap(): FocusTrapEntry | undefined {
  for (let i = trapStack.length - 1; i >= 0; i--) {
    const entry = trapStack[i];
    if (entry.node.isConnected && entry.isTopmost?.() === true) {
      return entry;
    }
  }
  for (let i = trapStack.length - 1; i >= 0; i--) {
    if (trapStack[i].node.isConnected) {
      return trapStack[i];
    }
  }
  return undefined;
}

/**
 * Resolves an element, selector, or getter from an `allowOutside` configuration.
 */
export function resolveAllowOutsideElement(
  target: FocusTrapAllowOutsideTarget
): Element | null {
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  if (typeof target === 'function') {
    return target() ?? null;
  }
  return target ?? null;
}

/**
 * Checks whether a given node resides within any of the elements specified in `allowOutside`.
 * Supports selector strings, elements, or reactive getters.
 */
export function isNodeAllowedOutside(
  target: Node | null,
  allowOutside?: FocusTrapAllowOutside
): boolean {
  if (!target || !allowOutside) return false;
  const list = Array.isArray(allowOutside) ? allowOutside : [allowOutside];
  const targetElement = target instanceof Element ? target : target.parentElement;

  for (const item of list) {
    if (!item) continue;
    if (typeof item === 'string') {
      try {
        if (targetElement?.closest(item)) {
          return true;
        }
      } catch {
        // Invalid selector syntax, ignore
      }
      continue;
    }
    const el = resolveAllowOutsideElement(item);
    if (el && (el === target || el.contains(target))) {
      return true;
    }
  }
  return false;
}
