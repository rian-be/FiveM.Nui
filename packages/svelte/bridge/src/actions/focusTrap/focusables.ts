import { type FocusTrapAllowOutside, isNodeAllowedOutside } from './trapStack';

/**
 * CSS selector matching all natively and custom focusable elements in HTML documents.
 */
export const FOCUSABLE_SELECTORS = [
  'a[href]',
  'area[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'button',
  'iframe',
  'summary',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]'
].join(', ');

/**
 * Returns all currently focusable elements in Tab order within a container.
 * Filters out disabled elements (including `<fieldset disabled>`), negative tabindexes,
 * aria-hidden, inert, and hidden elements.
 * Correctly scopes radio button groups per form so only the active radio button is in Tab order.
 *
 * @remarks
 * Assumes DOM order for keyboard navigation. Elements with positive tabindex (> 0)
 * alter standard browser tab sequencing and should generally be avoided.
 *
 * @param container - The root element to query focusable elements from.
 * @returns Array of focusable HTML elements within the container.
 */
export function getFocusables(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
  const focusables: HTMLElement[] = [];
  const radioGroups = new Map<HTMLFormElement | null, Map<string, HTMLInputElement>>();

  for (const el of elements) {
    if (el.matches(':disabled') || el.closest('fieldset[disabled]')) continue;
    if (el.tabIndex < 0) continue;
    if (el.closest('[aria-hidden="true"], [inert]')) continue;

    if (typeof el.checkVisibility === 'function') {
      if (!el.checkVisibility()) continue;
    } else {
      const isVisible =
        el.offsetWidth > 0 ||
        el.offsetHeight > 0 ||
        el.getClientRects().length > 0 ||
        el.offsetParent !== null;
      if (!isVisible) continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio' && el.name) {
      const form = el.form;
      let formRadios = radioGroups.get(form);
      if (!formRadios) {
        formRadios = new Map<string, HTMLInputElement>();
        radioGroups.set(form, formRadios);
      }
      const currentRadio = formRadios.get(el.name);
      if (el.checked) {
        formRadios.set(el.name, el);
      } else if (!currentRadio) {
        formRadios.set(el.name, el);
      }
      continue;
    }

    focusables.push(el);
  }

  if (radioGroups.size > 0) {
    const keep = new Set<Element>(focusables);
    for (const formRadios of radioGroups.values()) {
      for (const radio of formRadios.values()) {
        keep.add(radio);
      }
    }
    return elements.filter((el) => keep.has(el));
  }

  return focusables;
}

/**
 * Resolves the designated initial focus element from an element reference, selector, or getter.
 *
 * @param container - The container DOM element.
 * @param initialFocus - Target element, selector string, or getter function.
 * @returns The resolved HTMLElement, or null if none was found.
 */
export function resolveInitialElement(
  container: HTMLElement,
  initialFocus?: HTMLElement | string | (() => HTMLElement | null | undefined)
): HTMLElement | null {
  if (!initialFocus) return null;
  if (typeof initialFocus === 'string') {
    return (
      container.querySelector<HTMLElement>(initialFocus) ??
      document.querySelector<HTMLElement>(initialFocus)
    );
  }
  if (typeof initialFocus === 'function') {
    return initialFocus() ?? null;
  }
  return initialFocus;
}

/**
 * Confines Tab and Shift+Tab keyboard navigation within a container element.
 * Wraps around when reaching the start or end of the focus sequence.
 * Skips redirection if the currently focused element is allowed outside (e.g. portaled child).
 *
 * @param event - The keyboard event.
 * @param container - The container element confining focus.
 * @param allowOutside - Elements or selectors permitted to retain focus.
 * @param onEmptyFallback - Callback when no focusable elements exist in container.
 */
export function handleTabKey(
  event: KeyboardEvent,
  container: HTMLElement,
  allowOutside?: FocusTrapAllowOutside,
  onEmptyFallback?: () => void
): void {
  if (event.key !== 'Tab') return;

  const activeEl = document.activeElement;
  if (isNodeAllowedOutside(activeEl, allowOutside)) return;

  const focusables = getFocusables(container);
  if (focusables.length === 0) {
    event.preventDefault();
    if (!container.contains(activeEl)) {
      onEmptyFallback?.();
    }
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  if (event.shiftKey) {
    if (activeEl === first || !container.contains(activeEl)) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (activeEl === last || !container.contains(activeEl)) {
      event.preventDefault();
      first.focus();
    }
  }
}
