/**
 * Keyboard shortcut hooks for FiveM NUI.
 */

export interface KeyboardShortcut {
  /**
   * The key to match case-insensitively (eg. 'e', 'Enter', 'Escape', ' ', 'F1').
   * Ignored if `code` is provided.
   */
  key?: string;
  /**
   * @deprecated Use `key` instead. Alias kept for backwards compatibility.
   */
  event?: KeyboardEvent['key'];
  /**
   * Physical key code to match (e.g. 'KeyE', 'Digit1', 'Space', 'Enter').
   * When provided, `key` is completely ignored in favor of `code`.
   * Highly recommended for layout-independent shortcuts and combinations with Shift (e.g. Shift+1).
   */
  code?: string;
  /**
   * Require Ctrl key to be pressed in the FiveM Windows CEF environment.
   */
  ctrl?: boolean;
  /**
   * Require primary modifier key to be pressed.
   * In FiveM (Windows CEF), this is equivalent to `ctrl`.
   * Note: `ctrl` takes precedence over `mod` if both are defined.
   */
  mod?: boolean;
  /**
   * Require Alt key to be pressed.
   */
  alt?: boolean;
  /**
   * Require Shift key to be pressed.
   */
  shift?: boolean;
  /**
   * Require Meta (Windows key) to be pressed.
   */
  meta?: boolean;
  /**
   * When true, requires modifier keys (Ctrl, Alt, Shift, Meta) to strictly match
   * the specified options. Unspecified modifiers must NOT be pressed.
   * @default false
   */
  exact?: boolean;
  /**
   * Callback invoked when the shortcut matches.
   */
  callback: (event: KeyboardEvent) => void;
  /**
   * Whether the shortcut is currently enabled.
   * Accepts a boolean or a reactive getter `() => boolean`.
   * @default true
   */
  enabled?: boolean | (() => boolean);
  /**
   * Automatically call `event.preventDefault()`.
   * @default true
   */
  preventDefault?: boolean;
  /**
   * Automatically call `event.stopPropagation()`.
   * Stops bubbling up the DOM hierarchy.
   * @default false
   */
  stopPropagation?: boolean;
  /**
   * Automatically call `event.stopImmediatePropagation()`.
   * Prevents other listeners on the same element from being executed.
   * @default false
   */
  stopImmediatePropagation?: boolean;
  /**
   * If true, suppresses shortcut execution when the active element is an input,
   * textarea, select, contenteditable, or ARIA textbox/searchbox.
   * @default false
   */
  ignoreInputs?: boolean;
  /**
   * Ignore repeating keydown events when holding a key down.
   * @default false
   */
  ignoreRepeat?: boolean;
}

export interface KeyboardShortcutOptions {
  /**
   * Event target to attach the keydown listener to.
   * Can be an EventTarget (e.g. window, document, HTMLElement) or getter function returning one (e.g. `() => myElement`).
   * Note: The options object itself is evaluated once on init to make the target reactive, pass `target` as a getter function.
   * Defaults to `window` (global NUI shortcuts).
   */
  target?: EventTarget | null | (() => EventTarget | null);
  /**
   * Listen during capture phase. Useful for global NUI handlers to intercept events early.
   * @default false
   */
  capture?: boolean;
}

export type KeyboardShortcutsSource =
  | KeyboardShortcut[]
  | (() => KeyboardShortcut[]);

export type KeyboardShortcutSource =
  | KeyboardShortcut
  | (() => KeyboardShortcut);

/**
 * Checks whether the focused element accepts text input, supporting Shadow DOM via event.composedPath().
 */
function isTextInputFocused(event: KeyboardEvent): boolean {
  if (typeof document === 'undefined') return false;

  const path = event.composedPath();
  const el = path[0] instanceof HTMLElement ? path[0] : document.activeElement;

  if (!el || !(el instanceof HTMLElement)) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }

  if (el.isContentEditable) {
    return true;
  }

  const role = el.getAttribute('role');
  if (role === 'textbox' || role === 'searchbox') {
    return true;
  }

  if (el.closest('[contenteditable]:not([contenteditable="false"])')) {
    return true;
  }

  return false;
}

function isShortcutActive(shortcut: KeyboardShortcut, event: KeyboardEvent): boolean {
  // 1. Cheap checks first (ignoreRepeat)
  if (shortcut.ignoreRepeat && event.repeat) return false;

  // 2. Key or Code match (code overrides key entirely)
  if (shortcut.code) {
    if (event.code?.toLowerCase() !== shortcut.code.toLowerCase()) return false;
  } else {
    const expectedKey = (shortcut.key ?? shortcut.event ?? '').toLowerCase();
    if (!expectedKey) return false;
    if (event.key?.toLowerCase() !== expectedKey) return false;
  }

  // 3. Modifier match
  const expectedCtrl = shortcut.ctrl ?? shortcut.mod;

  if (shortcut.exact) {
    const needCtrl = Boolean(expectedCtrl);
    const needAlt = Boolean(shortcut.alt);
    const needShift = Boolean(shortcut.shift);
    const needMeta = Boolean(shortcut.meta);

    if (event.ctrlKey !== needCtrl) return false;
    if (event.altKey !== needAlt) return false;
    if (event.shiftKey !== needShift) return false;
    if (event.metaKey !== needMeta) return false;
  } else {
    if (expectedCtrl !== undefined && Boolean(expectedCtrl) !== event.ctrlKey) return false;
    if (shortcut.alt !== undefined && Boolean(shortcut.alt) !== event.altKey) return false;
    if (shortcut.shift !== undefined && Boolean(shortcut.shift) !== event.shiftKey) return false;
    if (shortcut.meta !== undefined && Boolean(shortcut.meta) !== event.metaKey) return false;
  }

  // 4. Expensive / side-effect checks last (enabled function, DOM queries for inputs)
  if (shortcut.enabled !== undefined) {
    const isAllowed = typeof shortcut.enabled === 'function' ? shortcut.enabled() : shortcut.enabled;
    if (!isAllowed) return false;
  }

  if (shortcut.ignoreInputs && isTextInputFocused(event)) return false;

  return true;
}

/**
 * Registers multiple keyboard shortcuts with reactive lifecycle management.
 * 
 * Note: 
 * - Must be called within a component initialization context (or wrapped in `$effect.root`).
 * - Array order matters: the first matching shortcut terminates evaluation via `break`.
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutsSource,
  options?: KeyboardShortcutOptions
): () => void {
  let controller: AbortController | null = null;

  function handler(event: KeyboardEvent) {
    // Ignore IME composition events (e.g. active Asian text input)
    if (event.isComposing) return;

    const list = typeof shortcuts === 'function' ? shortcuts() : shortcuts;
    if (!list || !Array.isArray(list)) return;

    for (const shortcut of list) {
      if (isShortcutActive(shortcut, event)) {
        if (shortcut.preventDefault ?? true) {
          event.preventDefault();
        }
        if (shortcut.stopPropagation) {
          event.stopPropagation();
        }
        if (shortcut.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        try {
          shortcut.callback(event);
        } catch (err) {
          console.error(
            '[nui-keyboard] Error in shortcut callback:',
            err
          );
        }
        break;
      }
    }
  }

  const cleanup = () => {
    if (controller) {
      controller.abort();
      controller = null;
    }
  };

  const setupListener = () => {
    cleanup(); // Prevent memory leaks on re-binding

    const targetFn = options?.target;
    const target = typeof targetFn === 'function' ? targetFn() : targetFn;
    const resolvedTarget = target ?? (typeof window !== 'undefined' ? window : null);

    if (!resolvedTarget) return;

    controller = new AbortController();
    resolvedTarget.addEventListener('keydown', handler as EventListener, {
      capture: options?.capture ?? false,
      signal: controller.signal
    });
  };

  // Lifecycle binding
  $effect(() => {
    setupListener();
    return cleanup;
  });

  return cleanup;
}

/**
 * Registers a single keyboard shortcut with reactive lifecycle management.
 */
export function useKeyboardShortcut(
  shortcut: KeyboardShortcutSource,
  options?: KeyboardShortcutOptions
): () => void {
  return useKeyboardShortcuts(
    () => {
      const item = typeof shortcut === 'function' ? shortcut() : shortcut;
      return item ? [item] : [];
    },
    options
  );
}
