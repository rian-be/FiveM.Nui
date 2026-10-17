import type { FocusTrapAllowOutside } from './trapStack';

export interface NuiFocusTrapOptions {
  /**
   * Whether the focus trap is actively confining focus.
   * Accepts a boolean or a reactive getter `() => boolean`.
   * @defaultValue true
   */
  enabled?: boolean | (() => boolean);

  /**
   * Custom element, selector or getter to receive initial focus upon activation.
   * If omitted, the first focusable element inside the node receives focus.
   */
  initialFocus?: HTMLElement | string | (() => HTMLElement | null | undefined);

  /**
   * Whether to restore focus to the previously focused element upon deactivation.
   * Can also be a specific HTMLElement to return focus to.
   * @defaultValue true
   */
  returnFocus?: boolean | HTMLElement;

  /**
   * Whether to automatically move focus inside the trap on activation.
   * @defaultValue true
   */
  autofocus?: boolean;

  /**
   * Elements, selectors, or getters outside the container that are permitted to receive focus
   * without being redirected back into the trap.
   *
   * Essential for portaled child elements such as select dropdowns, date pickers, or tooltips
   * rendered into `document.body` outside the modal container.
   */
  allowOutside?: FocusTrapAllowOutside;

  /**
   * Optional custom predicate to determine if this trap is currently topmost.
   * When provided, takes precedence over the default `trapStack` activation-order check.
   * Used by coordinators such as `nuiLayer` to synchronize focus trapping with priority order.
   *
   * @remarks
   * If providing custom `isTopmost` predicates manually, ensure only one active trap
   * evaluates to `true` at any given time to avoid conflicting focus containment.
   * Note that `nuiLayer` automatically controls and overrides this predicate based on layer priority.
   */
  isTopmost?: () => boolean;
}

export type NuiFocusTrapInput = boolean | NuiFocusTrapOptions | undefined;

/**
 * Normalizes boolean or option object parameters into `NuiFocusTrapOptions`.
 */
export function toFocusTrapOptions(
  input: NuiFocusTrapInput
): NuiFocusTrapOptions {
  if (input === undefined || typeof input === 'boolean') {
    return { enabled: input ?? true };
  }
  return input;
}
