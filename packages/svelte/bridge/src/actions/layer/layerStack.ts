import { NuiLayerDismissReason, type LayerInstance } from './types';
import { isNodeAllowedOutside } from '../focusTrap';
import { resolveElement } from '../clickOutside';

/**
 * Global stack of active overlay layers.
 * Manages hierarchical Escape key and outside click handling across modals, dialogs,
 * drawers, and portaled overlays in FiveM NUI.
 */
const layerStack: LayerInstance[] = [];

let globalController: AbortController | null = null;
let layerIdCounter = 0;

export function nextLayerId(): string {
  return `nui-layer-${++layerIdCounter}`;
}

export function pushLayer(instance: LayerInstance): void {
  layerStack.push(instance);
  ensureGlobalListeners();
}

export function removeLayer(instance: LayerInstance): void {
  const idx = layerStack.findIndex((l) => l === instance);
  if (idx !== -1) {
    layerStack.splice(idx, 1);
  }
  cleanupGlobalListeners();
}

export function getLayerStack(): readonly LayerInstance[] {
  return [...layerStack];
}

export function resetLayerStack(): void {
  layerStack.length = 0;
  cleanupGlobalListeners();
}

function getSortedStack(): LayerInstance[] {
  return [...layerStack].sort((a, b) => {
    return (a.getOptions().priority ?? 0) - (b.getOptions().priority ?? 0);
  });
}

export function getTopLayer(): LayerInstance | undefined {
  const sorted = getSortedStack();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const layer = sorted[i];
    const opts = layer.getOptions();
    const isEnabled = typeof opts.enabled === 'function' ? opts.enabled() : (opts.enabled ?? true);
    if (isEnabled && layer.node.isConnected) {
      return layer;
    }
  }
  return undefined;
}

function onGlobalKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing) return;
  if (layerStack.length === 0) return;

  const sorted = getSortedStack();

  // Find the topmost active layer that handles Escape
  for (let i = sorted.length - 1; i >= 0; i--) {
    const layer = sorted[i];
    const opts = layer.getOptions();
    const isEnabled = typeof opts.enabled === 'function' ? opts.enabled() : (opts.enabled ?? true);
    if (!isEnabled || !layer.node.isConnected) continue;

    const handlesEscape =
      opts.onEscape !== false &&
      (typeof opts.onEscape === 'function' || typeof opts.onDismiss === 'function');

    if (!handlesEscape) continue;

    if ((opts.ignoreRepeat ?? true) && event.repeat) {
      if (opts.preventEscapeDefault ?? true) {
        event.preventDefault();
      }
      return;
    }

    if (opts.preventEscapeDefault ?? true) {
      event.preventDefault();
    }
    if (opts.stopEscapePropagation) {
      event.stopPropagation();
    }

    try {
      if (typeof opts.onEscape === 'function') {
        opts.onEscape(event);
      } else if (typeof opts.onDismiss === 'function') {
        opts.onDismiss(NuiLayerDismissReason.Escape);
      }
    } catch (err) {
      console.error('[NuiLayer] Error in onEscape/onDismiss callback:', err);
    }

    // Only the topmost handling layer responds to Escape
    return;
  }
}

function onGlobalPointerDown(event: PointerEvent) {
  if (event.button !== 0 || layerStack.length === 0) return;

  const topLayer = getTopLayer();
  if (!topLayer) return;

  const opts = topLayer.getOptions();
  const handlesOutside =
    opts.onClickOutside !== false &&
    (typeof opts.onClickOutside === 'function' || typeof opts.onDismiss === 'function');

  if (!handlesOutside) return;

  const path = event.composedPath();

  // 1. Click inside top layer node
  if (path.includes(topLayer.node)) return;

  // 2. Click inside any allowed outside target (e.g. portaled dropdown)
  if (opts.allowOutside && isNodeAllowedOutside(event.target as Node | null, opts.allowOutside)) {
    return;
  }

  // 3. Click inside any ignoreOutside target (e.g. trigger button)
  if (opts.ignoreOutside) {
    for (const item of opts.ignoreOutside) {
      const el = resolveElement(item);
      if (el && path.includes(el)) return;
    }
  }

  // Trigger outside click for the topmost layer only
  try {
    if (typeof opts.onClickOutside === 'function') {
      opts.onClickOutside(event);
    } else if (typeof opts.onDismiss === 'function') {
      opts.onDismiss(NuiLayerDismissReason.Outside);
    }
  } catch (err) {
    console.error('[NuiLayer] Error in onClickOutside/onDismiss callback:', err);
  }
}

export function ensureGlobalListeners(): void {
  if (globalController || layerStack.length === 0) return;
  globalController = new AbortController();
  document.addEventListener('keydown', onGlobalKeyDown, {
    capture: true,
    signal: globalController.signal
  });
  document.addEventListener('pointerdown', onGlobalPointerDown, {
    capture: true,
    signal: globalController.signal
  });
}

export function cleanupGlobalListeners(): void {
  if (layerStack.length === 0 && globalController) {
    globalController.abort();
    globalController = null;
  }
}
