import type { Action } from 'svelte/action';
import { nuiFocusTrap, type NuiFocusTrapOptions } from '../focusTrap';
import {
  type NuiLayerOptions,
  type NuiLayerInput,
  type LayerInstance,
  toLayerOptions
} from './types';
import {
  pushLayer,
  removeLayer,
  getTopLayer,
  nextLayerId
} from './layerStack';

/**
 * Managing an overlay layer in FiveM NUI.
 *
 * Coordinates:
 * - **Escape key**: Traverses the layer stack top-to-bottom. The topmost active layer that handles Escape
 *   receives the event and dismisses. If the topmost layer disables Escape (`onEscape: false`),
 *   lower layers can handle it.
 * - **Outside click**: Evaluates strictly the topmost active layer. If the topmost layer disables outside
 *   clicks (`onClickOutside: false`), clicks outside are blocked and do NOT fall through to underlying layers,
 *   preserving modal barrier isolation.
 * - **Focus trap**: Integrates `nuiFocusTrap` synchronized with layer priority so focus containment and Tab
 *   navigation are enforced by the topmost layer even when layers have varying priorities.
 * - **Portal integration**: `allowOutside` allows portaled children (selects, datepickers, tooltips)
 *   without triggering outside clicks or breaking focus containment.
 *
 * @param node - The DOM element attaching the layer action.
 * @param parameter - Dismissal callback function or layer configuration options object.
 *
 * @example
 * ```svelte
 * <div use:nuiLayer={() => (isOpen = false)}>...</div>
 * <div use:nuiLayer={{ onDismiss: close, allowOutside: '.portal-menu' }}>...</div>
 * ```
 */
export const nuiLayer: Action<HTMLElement, NuiLayerInput> = (node, parameter) => {
  let currentParam = parameter;
  let active = false;
  let trapAction: ReturnType<typeof nuiFocusTrap> | null = null;
  const id = toLayerOptions(parameter).id ?? nextLayerId();

  function getOptions(): NuiLayerOptions {
    return toLayerOptions(currentParam);
  }

  function isEnabled(): boolean {
    const opts = getOptions();
    const { enabled } = opts;
    return typeof enabled === 'function' ? enabled() : (enabled ?? true);
  }

  const instance: LayerInstance = {
    id,
    node,
    getOptions
  };

  function syncFocusTrap() {
    const opts = getOptions();
    const enabled = isEnabled();

    if (!enabled || opts.trapFocus === false) {
      if (trapAction) {
        trapAction.destroy?.();
        trapAction = null;
      }
      return;
    }

    const trapConfig: NuiFocusTrapOptions =
      typeof opts.trapFocus === 'object' ? { ...opts.trapFocus } : {};

    if (trapConfig.allowOutside === undefined && opts.allowOutside !== undefined) {
      trapConfig.allowOutside = opts.allowOutside;
    }
    if (trapConfig.initialFocus === undefined && opts.initialFocus !== undefined) {
      trapConfig.initialFocus = opts.initialFocus;
    }
    if (trapConfig.returnFocus === undefined && opts.returnFocus !== undefined) {
      trapConfig.returnFocus = opts.returnFocus;
    }
    if (trapConfig.autofocus === undefined && opts.autofocus !== undefined) {
      trapConfig.autofocus = opts.autofocus;
    }
    trapConfig.enabled = enabled;
    trapConfig.isTopmost = () => getTopLayer() === instance;

    if (!trapAction) {
      trapAction = nuiFocusTrap(node, trapConfig);
    } else {
      trapAction.update?.(trapConfig);
    }
  }

  function setup() {
    if (active) return;
    active = true;
    pushLayer(instance);
    syncFocusTrap();
  }

  function deactivate() {
    if (!active) return;
    active = false;

    if (trapAction) {
      trapAction.destroy?.();
      trapAction = null;
    }

    removeLayer(instance);
  }

  if (isEnabled()) {
    setup();
  }

  return {
    update(newParam) {
      const wasEnabled = active;
      currentParam = newParam;
      const nowEnabled = isEnabled();

      if (!wasEnabled && nowEnabled) {
        setup();
      } else if (wasEnabled && !nowEnabled) {
        deactivate();
      } else if (nowEnabled) {
        syncFocusTrap();
      }
    },
    destroy() {
      deactivate();
    }
  };
};
