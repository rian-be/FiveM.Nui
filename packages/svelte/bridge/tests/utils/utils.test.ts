import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isNui, isBrowser, getResourceName } from '../../src/utils/env';
import { useNuiKey, useNuiEscape } from '../../src/utils/keyboard';

describe('env utils', () => {
  const originalGetParentResourceName = (globalThis as any).GetParentResourceName;

  afterEach(() => {
    if (originalGetParentResourceName) {
      (globalThis as any).GetParentResourceName = originalGetParentResourceName;
    } else {
      delete (globalThis as any).GetParentResourceName;
    }
  });

  it('detects NUI environment correctly', () => {
    (globalThis as any).GetParentResourceName = () => 'test_resource';
    expect(isNui()).toBe(true);
    expect(isBrowser()).toBe(false);
    expect(getResourceName()).toBe('test_resource');
  });

  it('detects standard browser environment correctly', () => {
    delete (globalThis as any).GetParentResourceName;
    expect(isNui()).toBe(false);
    expect(isBrowser()).toBe(true);
    expect(getResourceName('fallback_res')).toBe('fallback_res');
  });

  it('handles GetParentResourceName throwing an exception and returns fallback', () => {
    (globalThis as any).GetParentResourceName = () => {
      throw new Error('NUI not ready');
    };
    expect(isNui()).toBe(true);
    expect(getResourceName('fallback_on_error')).toBe('fallback_on_error');
  });
});

describe('keyboard utils (useNuiKey & useNuiEscape)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function createKeyEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init
    });
    vi.spyOn(event, 'preventDefault');
    vi.spyOn(event, 'stopPropagation');
    return event;
  }

  it('triggers handler when matched key is pressed', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey('e', handler);

    window.dispatchEvent(createKeyEvent('e'));
    expect(handler).toHaveBeenCalledTimes(1);

    // Other key should not trigger
    window.dispatchEvent(createKeyEvent('f'));
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
    window.dispatchEvent(createKeyEvent('e'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports array of keys and case-insensitivity', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey(['i', 'm'], handler);

    window.dispatchEvent(createKeyEvent('I'));
    expect(handler).toHaveBeenCalledTimes(1);

    window.dispatchEvent(createKeyEvent('M'));
    expect(handler).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it('respects enabled option as boolean and getter', () => {
    const handler = vi.fn();
    let isEnabled = false;

    const cleanup1 = useNuiKey('x', handler, { enabled: false });
    window.dispatchEvent(createKeyEvent('x'));
    expect(handler).not.toHaveBeenCalled();
    cleanup1();

    const cleanup2 = useNuiKey('x', handler, { enabled: () => isEnabled });
    window.dispatchEvent(createKeyEvent('x'));
    expect(handler).not.toHaveBeenCalled();

    isEnabled = true;
    window.dispatchEvent(createKeyEvent('x'));
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup2();
  });

  it('ignores repeat key events when ignoreRepeat is true', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey('r', handler, { ignoreRepeat: true });

    window.dispatchEvent(createKeyEvent('r', { repeat: false }));
    expect(handler).toHaveBeenCalledTimes(1);

    window.dispatchEvent(createKeyEvent('r', { repeat: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('suppresses shortcut execution in text inputs when ignoreInputs is true', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey('k', handler, { ignoreInputs: true });

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    window.dispatchEvent(createKeyEvent('k'));
    expect(handler).not.toHaveBeenCalled();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    window.dispatchEvent(createKeyEvent('k'));
    expect(handler).not.toHaveBeenCalled();

    const select = document.createElement('select');
    document.body.appendChild(select);
    select.focus();

    window.dispatchEvent(createKeyEvent('k'));
    expect(handler).not.toHaveBeenCalled();

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    editable.focus();

    window.dispatchEvent(createKeyEvent('k'));
    expect(handler).not.toHaveBeenCalled();

    // When focus is on body / button, it triggers
    (document.activeElement as HTMLElement)?.blur();
    window.dispatchEvent(createKeyEvent('k'));
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('enforces modifier keys (ctrl, alt, shift, meta)', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey('s', handler, { ctrl: true, shift: true });

    // Without modifiers
    window.dispatchEvent(createKeyEvent('s', { ctrlKey: false, shiftKey: false }));
    expect(handler).not.toHaveBeenCalled();

    // Only ctrl
    window.dispatchEvent(createKeyEvent('s', { ctrlKey: true, shiftKey: false }));
    expect(handler).not.toHaveBeenCalled();

    // Both ctrl and shift
    window.dispatchEvent(createKeyEvent('s', { ctrlKey: true, shiftKey: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('enforces alt and meta modifiers', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey('d', handler, { alt: true, meta: true });

    window.dispatchEvent(createKeyEvent('d', { altKey: true, metaKey: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('calls preventDefault and stopPropagation when requested', () => {
    const handler = vi.fn();
    const cleanup = useNuiKey('tab', handler, { preventDefault: true, stopPropagation: true });

    const event = createKeyEvent('Tab');
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();

    cleanup();
  });

  it('useNuiEscape defaults to listening for Escape with preventDefault', () => {
    const onEscape = vi.fn();
    const cleanup = useNuiEscape(onEscape);

    const event = createKeyEvent('Escape');
    window.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();

    cleanup();
  });
});
