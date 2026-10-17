export type ClickOutsideTarget =
  | Element
  | string
  | null
  | undefined
  | (() => Element | null | undefined);

export interface NuiClickOutsideParameter {
  /**
   * Callback invoked when a click or touch occurs outside the target node.
   */
  onClickOutside?: (event: PointerEvent) => void;

  /**
   * @deprecated Use `onClickOutside` instead.
   */
  callback?: (event: PointerEvent) => void;

  /**
   * Whether the outside click detector is active.
   * Can be a static boolean or a reactive getter `() => boolean`.
   * @defaultValue true
   */
  enabled?: boolean | (() => boolean);

  /**
   * Elements, selectors, or getters to exclude from triggering outside click.
   *
   * @remarks
   * **Trigger / Toggle Buttons**:
   * Because `capture: true` listens on the capturing phase (`pointerdown` fires before `click`),
   * clicking a toggle/trigger button without adding it to `ignore` will cause an immediate
   * flicker (the outside click closes the popover during `pointerdown`, and the button's
   * subsequent `click` immediately re-opens it). Always pass your toggle button in `ignore`.
   */
  ignore?: ClickOutsideTarget[];

  /**
   * Listen during capture phase to intercept before bubbling mutations.
   * @defaultValue true
   */
  capture?: boolean;
}

export type NuiClickOutsideInput =
  | ((event: PointerEvent) => void)
  | NuiClickOutsideParameter;

export function toClickOutsideOptions(
  param: NuiClickOutsideInput | undefined
): NuiClickOutsideParameter | undefined {
  if (!param) return undefined;
  return typeof param === 'function' ? { onClickOutside: param } : param;
}
