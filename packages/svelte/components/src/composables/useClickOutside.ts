import type { Action } from 'svelte/action';
import {
  nuiClickOutside,
  useClickOutside as bridgeUseClickOutside,
  type ClickOutsideTarget,
  type NuiClickOutsideParameter
} from '@fivem-nui/svelte';

export interface ClickOutsideOptions {
  /**
   * Callback invoked when a click or touch occurs outside the target element.
   */
  callback: (event: MouseEvent | TouchEvent | PointerEvent) => void;
  /**
   * Reactive getter or boolean to control whether detection is active.
   * @default true
   */
  enabled?: boolean | (() => boolean);
  /**
   * Elements, selectors, or getters to exclude from triggering outside click.
   * Essential for toggle buttons and popover trigger elements.
   */
  ignore?: ClickOutsideTarget[];
  /**
   * Listen during capture phase.
   * @default true
   */
  capture?: boolean;
}

export type ClickOutsideInput =
  | (() => void)
  | ((event: MouseEvent | TouchEvent | PointerEvent) => void)
  | ClickOutsideOptions
  | NuiClickOutsideParameter;

function mapOptions(param: ClickOutsideInput): NuiClickOutsideParameter {
  if (typeof param === 'function') {
    return {
      callback: param as (event: PointerEvent) => void
    };
  }

  const cb = 'callback' in param && param.callback
    ? (param.callback as (event: PointerEvent) => void)
    : 'onClickOutside' in param && param.onClickOutside
      ? (param.onClickOutside as (event: PointerEvent) => void)
      : undefined;

  return {
    callback: cb,
    onClickOutside: cb,
    enabled: param.enabled,
    ignore: 'ignore' in param ? param.ignore : undefined,
    capture: 'capture' in param ? param.capture : true
  };
}

export interface ClickOutsideActionReturn {
  update: (param: ClickOutsideInput) => void;
  destroy: () => void;
}

export type ClickOutsideAction = (
  node: HTMLElement,
  param: ClickOutsideInput
) => ClickOutsideActionReturn;

/**
 * Action for detecting clicks outside an element.
 *
 * Backed by `@fivem-nui/svelte` with `event.composedPath()` (eliminating the detached
 * DOM node bug in dynamic lists) and `AbortController` lifecycle management.
 *
 * @example
 * ```svelte
 * <div use:clickOutsideAction={() => (open = false)}>...</div>
 * <div use:clickOutsideAction={{ callback: close, ignore: [btnEl] }}>...</div>
 * ```
 */
export const clickOutsideAction: ClickOutsideAction = (
  node,
  param
) => {
  const innerAction = nuiClickOutside(node, mapOptions(param));

  return {
    update(newParam) {
      innerAction?.update?.(mapOptions(newParam));
    },
    destroy() {
      innerAction?.destroy?.();
    }
  };
};

/**
 * Functional composable to watch click outside for an element getter or reference.
 * Automatically cleans up on component unmount via `$effect` in `@fivem-nui/svelte`.
 */
function isOptionsGetter(fn: unknown): boolean {
  if (typeof fn !== 'function') return false;
  if (fn.length > 0) return false;
  const str = Function.prototype.toString.call(fn);
  return /(return\s*\{|\(\s*\{)[\s\S]*\b(callback|onClickOutside|enabled|ignore|capture)\b/.test(str);
}

export function useClickOutside(
  getElement: () => HTMLElement | null | undefined,
  callbackOrOptions: ClickOutsideInput | (() => ClickOutsideInput)
): void {
  const getOptions = (): NuiClickOutsideParameter => {
    if (typeof callbackOrOptions !== 'function') {
      return mapOptions(callbackOrOptions);
    }

    if (isOptionsGetter(callbackOrOptions)) {
      const result = (callbackOrOptions as () => ClickOutsideInput)();
      return mapOptions(result);
    }

    return {
      callback: callbackOrOptions as (event: PointerEvent) => void,
      onClickOutside: callbackOrOptions as (event: PointerEvent) => void,
      capture: true
    };
  };

  bridgeUseClickOutside(getElement, getOptions);
}

export const useClickOutsideElement = useClickOutside;