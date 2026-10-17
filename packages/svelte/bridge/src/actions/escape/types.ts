export enum NuiEscapeTarget {
  Element = 'element',
  Window = 'window',
  Document = 'document'
}

export interface NuiEscapeParameter {
  /**
   * Callback invoked when the Escape key is pressed.
   */
  onEscape?: (event: KeyboardEvent) => void;

  /**
   * @deprecated Use `onEscape` instead.
   */
  callback?: (event: KeyboardEvent) => void;

  /**
   * Whether the Escape listener is active.
   * Accepts a boolean or a reactive getter `() => boolean`.
   * @defaultValue true
   */
  enabled?: boolean | (() => boolean);

  /**
   * Where to attach the listener:
   * - `NuiEscapeTarget.Document`: listens globally on the document (default; does not require element focus)
   * - `NuiEscapeTarget.Window`: listens globally on the window
   * - `NuiEscapeTarget.Element`: listens only for keydown events within this element (requires the element to have focus, e.g. tabindex="-1")
   * @defaultValue NuiEscapeTarget.Document
   */
  target?: NuiEscapeTarget;

  /**
   * Whether to listen during the capturing phase.
   * Useful when inner elements might stop propagation before bubbling reaches window/document.
   * @defaultValue false
   */
  capture?: boolean;

  /**
   * Whether to call `event.preventDefault()`.
   * @defaultValue true
   */
  preventDefault?: boolean;

  /**
   * Whether to stop event propagation to parent elements.
   * @defaultValue false
   */
  stopPropagation?: boolean;

  /**
   * Whether to stop immediate propagation to other listeners on the same target.
   * @defaultValue false
   */
  stopImmediatePropagation?: boolean;

  /**
   * Whether to ignore repeated keydown events fired while holding the Escape key down.
   *
   * @remarks
   * If `true` and `preventDefault: true`, `event.preventDefault()` will still be invoked
   * on repeated keydown events to suppress browser/CEF default actions, but the callback itself
   * will only be executed once on the initial keydown.
   * @defaultValue true
   */
  ignoreRepeat?: boolean;

  /**
   * Whether to ignore the Escape keydown event if an earlier handler has already called `event.preventDefault()`.
   * Useful when multiple independent Escape listeners are registered on `document` to avoid firing handlers
   * after an inner/prior component has already handled the event.
   * @defaultValue false
   */
  ignoreHandled?: boolean;
}

export type NuiEscapeInput =
  | ((event: KeyboardEvent) => void)
  | NuiEscapeParameter;

export function toEscapeOptions<T extends NuiEscapeParameter = NuiEscapeParameter>(
  param?: ((event: KeyboardEvent) => void) | T
): T | undefined {
  if (!param) return undefined;
  return typeof param === 'function' ? ({ onEscape: param } as T) : param;
}
