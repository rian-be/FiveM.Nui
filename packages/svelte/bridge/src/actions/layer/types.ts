import type { NuiFocusTrapOptions, FocusTrapAllowOutside } from '../focusTrap';
import type { ClickOutsideTarget } from '../clickOutside';

export enum NuiLayerDismissReason {
  Escape = 'escape',
  Outside = 'outside'
}

export interface NuiLayerOptions {
  /**
   * Unique identifier for the layer.
   * Auto-generated if omitted.
   */
  id?: string;

  /**
   * Whether the layer is active in the layer stack.
   * Accepts a boolean or a reactive getter `() => boolean`.
   * @defaultValue true
   */
  enabled?: boolean | (() => boolean);

  /**
   * Unified callback invoked when the layer should be dismissed
   * (either via Escape key or outside click while topmost).
   */
  onDismiss?: (reason: NuiLayerDismissReason) => void;

  /**
   * Specific callback invoked when the Escape key is pressed while this layer is topmost.
   * Set to `false` to disable Escape handling for this layer.
   */
  onEscape?: ((event: KeyboardEvent) => void) | boolean;

  /**
   * Specific callback invoked when a click occurs outside this layer while it is topmost.
   * Set to `false` to disable outside click handling for this layer.
   */
  onClickOutside?: ((event: PointerEvent) => void) | boolean;

  /**
   * Focus trap configuration for this layer:
   * - `true`: enables default focus trap (default)
   * - `false`: disables focus trap
   * - `NuiFocusTrapOptions`: custom focus trap options (initialFocus, returnFocus, autofocus, etc.)
   *
   * @remarks
   * `nuiLayer` automatically controls and overrides `trapFocus.isTopmost` so focus containment
   * is synchronized strictly with layer priority (`getTopLayer() === instance`).
   * @defaultValue true
   */
  trapFocus?: boolean | NuiFocusTrapOptions;

  /**
   * Elements, selectors, or getters outside the container that are permitted.
   * Shared between focus trap (won't redirect Tab from them) and click-outside (won't dismiss on them).
   * Essential for portaled child elements (e.g. dropdowns, date pickers, tooltips).
   */
  allowOutside?: FocusTrapAllowOutside;

  /**
   * Additional elements, selectors, or getters to ignore specifically for click-outside detection
   * (e.g. the toggle or trigger button that opened this layer).
   */
  ignoreOutside?: ClickOutsideTarget[];

  /**
   * Custom element, selector or getter to receive initial focus upon activation.
   * Shorthand for `trapFocus.initialFocus`.
   */
  initialFocus?: HTMLElement | string | (() => HTMLElement | null | undefined);

  /**
   * Whether to restore focus to previously focused element upon layer deactivation.
   * Shorthand for `trapFocus.returnFocus`.
   * @defaultValue true
   */
  returnFocus?: boolean | HTMLElement;

  /**
   * Whether to automatically move focus inside the layer on activation.
   * Shorthand for `trapFocus.autofocus`.
   * @defaultValue true
   */
  autofocus?: boolean;

  /**
   * Priority/z-index override. Layers with higher priority are considered on top
   * regardless of activation order. Equal priority layers follow activation order.
   * @defaultValue 0
   */
  priority?: number;

  /**
   * Whether to ignore repeated keydown events fired while holding the Escape key down.
   * If `true`, holding Escape will not dismiss subsequent layers in rapid succession.
   * @defaultValue true
   */
  ignoreRepeat?: boolean;

  /**
   * Whether to call `event.preventDefault()` when Escape is handled.
   * @defaultValue true
   */
  preventEscapeDefault?: boolean;

  /**
   * Whether to call `event.stopPropagation()` when Escape is handled.
   * Defaults to `false` to avoid breaking uncoordinated parent listeners on window/document.
   * @defaultValue false
   */
  stopEscapePropagation?: boolean;
}

export type NuiLayerInput =
  | ((reason: NuiLayerDismissReason) => void)
  | NuiLayerOptions
  | undefined;

export function toLayerOptions(input: NuiLayerInput): NuiLayerOptions {
  if (!input) return { enabled: true };
  if (typeof input === 'function') {
    return { enabled: true, onDismiss: input };
  }
  return input;
}

export interface LayerInstance {
  id: string;
  node: HTMLElement;
  getOptions: () => NuiLayerOptions;
}
