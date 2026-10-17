import { onDestroy } from 'svelte';

export interface KeyboardShortcut {
  /**
   * The key to match (case-insensitive, e.g. 'e', 'Enter', 'Escape', '1').
   */
  key?: string;
  /**
   * Alias for `key`.
   */
  event?: KeyboardEvent['key'];
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
   * @default false
   */
  stopPropagation?: boolean;
  /**
   * If true, suppresses shortcut execution when the active element is an input,
   * textarea, select, or contenteditable.
   * @default false
   */
  ignoreInputs?: boolean;
  /**
   * Ignore repeating keydown events when holding a key down.
   * @default false
   */
  ignoreRepeat?: boolean;
}

function isTextInputFocused(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    return true;
  }
  return el.hasAttribute('contenteditable') && el.getAttribute('contenteditable') !== 'false';
}

function isShortcutActive(shortcut: KeyboardShortcut, event: KeyboardEvent): boolean {
  if (shortcut.enabled !== undefined) {
    const isAllowed = typeof shortcut.enabled === 'function' ? shortcut.enabled() : shortcut.enabled;
    if (!isAllowed) return false;
  }

  if (shortcut.ignoreRepeat && event.repeat) return false;
  if (shortcut.ignoreInputs && isTextInputFocused()) return false;

  const expectedKey = (shortcut.key ?? shortcut.event ?? '').toLowerCase();
  if (expectedKey && event.key.toLowerCase() !== expectedKey) return false;

  if (shortcut.ctrl !== undefined && Boolean(shortcut.ctrl) !== event.ctrlKey) return false;
  if (shortcut.alt !== undefined && Boolean(shortcut.alt) !== event.altKey) return false;
  if (shortcut.shift !== undefined && Boolean(shortcut.shift) !== event.shiftKey) return false;
  if (shortcut.meta !== undefined && Boolean(shortcut.meta) !== event.metaKey) return false;

  return true;
}

/**
 * Senior++ Svelte 5 composable: Registers multiple keyboard shortcuts with lifecycle cleanup.
 *
 * @example
 * ```ts
 * useKeyboardShortcuts([
 *   { key: '1', callback: () => selectTab('shop'), ignoreInputs: true },
 *   { key: 'Escape', callback: () => closePanel() }
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]): () => void {
  let controller: AbortController | null = null;

  function handler(event: KeyboardEvent) {
    for (const shortcut of shortcuts) {
      if (isShortcutActive(shortcut, event)) {
        if (shortcut.preventDefault ?? true) {
          event.preventDefault();
        }
        if (shortcut.stopPropagation) {
          event.stopPropagation();
        }
        shortcut.callback(event);
        break;
      }
    }
  }

  if (typeof window !== 'undefined') {
    controller = new AbortController();
    window.addEventListener('keydown', handler, {
      signal: controller.signal
    });
  }

  const cleanup = () => {
    if (controller) {
      controller.abort();
      controller = null;
    }
  };

  try {
    onDestroy(cleanup);
  } catch {
    // Outside component lifecycle
  }

  return cleanup;
}

/**
 * Senior++ Svelte 5 composable: Registers a single keyboard shortcut.
 */
export function useKeyboardShortcut(shortcut: KeyboardShortcut): () => void {
  return useKeyboardShortcuts([shortcut]);
}
