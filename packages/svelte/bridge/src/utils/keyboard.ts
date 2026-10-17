import { onDestroy } from 'svelte';

/**
 * Keyboard modifier keys.
 */
export enum NuiKeyboardModifier {
  Ctrl = 'ctrl',
  Alt = 'alt',
  Shift = 'shift',
  Meta = 'meta'
}

/**
 * Standard special key names commonly used in FiveM NUI shortcuts.
 */
export enum NuiSpecialKey {
  Escape = 'Escape',
  Enter = 'Enter',
  Tab = 'Tab',
  Space = ' ',
  Backspace = 'Backspace',
  ArrowUp = 'ArrowUp',
  ArrowDown = 'ArrowDown',
  ArrowLeft = 'ArrowLeft',
  ArrowRight = 'ArrowRight'
}

/**
 * Configuration options for keyboard event handlers and shortcuts.
 */
export interface KeyOptions {
  /**
   * Listen during capture phase.
   * @defaultValue false
   */
  capture?: boolean;

  /**
   * Automatically call `event.preventDefault()`.
   * @defaultValue false
   */
  preventDefault?: boolean;

  /**
   * Automatically call `event.stopPropagation()`.
   * @defaultValue false
   */
  stopPropagation?: boolean;

  /**
   * Whether the key shortcut is enabled.
   * Accepts a static boolean or a reactive getter `() => boolean`.
   * @defaultValue true
   */
  enabled?: boolean | (() => boolean);

  /**
   * If true, suppresses shortcut execution when the active element is an input,
   * textarea, select, or contenteditable.
   * Crucial in FiveM NUI panels to prevent game hotkeys firing while typing messages/searches.
   * @defaultValue false
   */
  ignoreInputs?: boolean;

  /**
   * Ignore repeating keydown events triggered while holding a key down.
   * @defaultValue false
   */
  ignoreRepeat?: boolean;

  /**
   * Require Ctrl key to be pressed (or Cmd on Mac).
   */
  ctrl?: boolean;

  /**
   * Require Alt key to be pressed.
   */
  alt?: boolean;

  /**
   * Require Shift key to be pressed.
   */
  shift?: boolean;

  /**
   * Require Meta (Windows / Cmd) key to be pressed.
   */
  meta?: boolean;

  /**
   * Component lifecycle registration strategy:
   * - `true`: Strictly requires component initialization lifecycle; registers `onDestroy`.
   *   If called outside a component, unsubscribes immediately to prevent memory leaks and throws.
   * - `false`: Disables automatic lifecycle cleanup. The caller must invoke the returned cleanup function manually.
   * - `undefined` (default): Attempts to register `onDestroy` within a component lifecycle;
   *   falls back gracefully to manual cleanup if called outside a component.
   * @defaultValue undefined
   */
  autoDestroy?: boolean;
}

function isTextInputActive(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return el.hasAttribute('contenteditable') && el.getAttribute('contenteditable') !== 'false';
}

/**
 * Registers a keyboard shortcut with automatic lifecycle management.
 *
 * Designed for FiveM NUI with support for:
 * - `ignoreInputs`: prevents hotkeys from firing while typing in input fields.
 * - Modifier keys (Ctrl, Alt, Shift, Meta).
 * - Automatic cleanup via `onDestroy` and `AbortController`.
 *
 * @param keys - Key or array of keys (case-insensitive) to listen for.
 * @param handler - Callback function invoked when matching keydown occurs.
 * @param options - Optional shortcut configuration including modifiers and lifecycle strategy.
 * @returns Cleanup function to remove event listeners.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useNuiKey } from '@fivem-nui/svelte';
 *   useNuiKey('e', () => interact(), { ignoreInputs: true });
 * </script>
 * ```
 */
export function useNuiKey(
  keys: string | string[],
  handler: (event: KeyboardEvent) => void,
  options: KeyOptions = {}
): () => void {
  const targetKeys = (Array.isArray(keys) ? keys : [keys]).map((k) => k.toLowerCase());
  const {
    capture = false,
    preventDefault = false,
    stopPropagation = false,
    enabled,
    ignoreInputs = false,
    ignoreRepeat = false,
    ctrl,
    alt,
    shift,
    meta
  } = options;

  let controller: AbortController | null = null;

  function isAllowed(): boolean {
    if (enabled === undefined) return true;
    return typeof enabled === 'function' ? enabled() : enabled;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!isAllowed()) return;
    if (ignoreRepeat && event.repeat) return;
    if (ignoreInputs && isTextInputActive()) return;

    if (ctrl !== undefined && event.ctrlKey !== ctrl) return;
    if (alt !== undefined && event.altKey !== alt) return;
    if (shift !== undefined && event.shiftKey !== shift) return;
    if (meta !== undefined && event.metaKey !== meta) return;

    if (targetKeys.includes(event.key.toLowerCase())) {
      if (preventDefault) {
        event.preventDefault();
      }
      if (stopPropagation) {
        event.stopPropagation();
      }
      try {
        handler(event);
      } catch (err) {
        console.error('[NuiKey] Error in key handler callback:', err);
      }
    }
  }

  if (typeof window !== 'undefined') {
    controller = new AbortController();
    window.addEventListener('keydown', onKeyDown, {
      capture,
      signal: controller.signal
    });
  }

  let isCleanedUp = false;
  function cleanup() {
    if (isCleanedUp) return;
    isCleanedUp = true;
    if (controller) {
      controller.abort();
      controller = null;
    }
  }

  if (options.autoDestroy !== false) {
    try {
      onDestroy(cleanup);
    } catch (lifecycleError) {
      if (options.autoDestroy === true) {
        cleanup();
        throw lifecycleError;
      }
      // Best-effort fallback when autoDestroy is undefined and called outside component
    }
  }

  return cleanup;
}

/**
 * Listens for the `Escape` key to close or dismiss NUI panels.
 * In FiveM, ESC is the universal standard for closing NUI windows.
 *
 * @param onEscape - Callback function invoked when the Escape key is pressed.
 * @param options - Optional configuration overriding default key options (`preventDefault` defaults to `true`).
 * @returns Cleanup function to remove the Escape listener.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useNuiEscape, nui } from '@fivem-nui/svelte';
 *   useNuiEscape(() => nui.notify('close'));
 * </script>
 * ```
 */
export function useNuiEscape(
  onEscape: (event: KeyboardEvent) => void,
  options: KeyOptions = {}
): () => void {
  return useNuiKey(NuiSpecialKey.Escape, onEscape, {
    preventDefault: true,
    ...options
  });
}