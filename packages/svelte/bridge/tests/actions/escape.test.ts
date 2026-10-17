import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nuiEscapeAction, createEscapeHandler } from '../../src/actions/escape';

describe('nuiEscapeAction', () => {
  let node: HTMLElement;

  beforeEach(() => {
    node = document.createElement('div');
    document.body.appendChild(node);
  });

  afterEach(() => {
    node.remove();
    vi.restoreAllMocks();
  });

  function createKeyboardEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init
    });
    vi.spyOn(event, 'preventDefault');
    vi.spyOn(event, 'stopPropagation');
    vi.spyOn(event, 'stopImmediatePropagation');
    return event;
  }

  it('invokes onEscape when Escape key is pressed', () => {
    const onEscape = vi.fn();
    const action = nuiEscapeAction(node, onEscape);

    const event = createKeyboardEvent('Escape');
    document.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled();

    action.destroy?.();
  });

  it('ignores keys other than Escape', () => {
    const onEscape = vi.fn();
    const action = nuiEscapeAction(node, onEscape);

    const event = createKeyboardEvent('Enter');
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();

    action.destroy?.();
  });

  it('does NOT swallow event when no handler is provided or enabled is false', () => {
    // 1. Without handler
    const actionWithoutHandler = nuiEscapeAction(node, {});
    const event1 = createKeyboardEvent('Escape');
    document.dispatchEvent(event1);

    expect(event1.preventDefault).not.toHaveBeenCalled();
    expect(event1.stopPropagation).not.toHaveBeenCalled();
    actionWithoutHandler.destroy?.();

    // 2. Disabled via boolean
    const onEscape = vi.fn();
    const actionDisabled = nuiEscapeAction(node, { onEscape, enabled: false });
    const event2 = createKeyboardEvent('Escape');
    document.dispatchEvent(event2);

    expect(onEscape).not.toHaveBeenCalled();
    expect(event2.preventDefault).not.toHaveBeenCalled();
    actionDisabled.destroy?.();

    // 3. Disabled via reactive getter
    let isEnabled = false;
    const actionGetter = nuiEscapeAction(node, { onEscape, enabled: () => isEnabled });
    const event3 = createKeyboardEvent('Escape');
    document.dispatchEvent(event3);

    expect(onEscape).not.toHaveBeenCalled();
    expect(event3.preventDefault).not.toHaveBeenCalled();

    // Toggle enabled getter
    isEnabled = true;
    const event4 = createKeyboardEvent('Escape');
    document.dispatchEvent(event4);
    expect(onEscape).toHaveBeenCalledTimes(1);

    actionGetter.destroy?.();
  });

  it('ignores Escape during IME composition (isComposing: true)', () => {
    const onEscape = vi.fn();
    const action = nuiEscapeAction(node, onEscape);

    const event = createKeyboardEvent('Escape', { isComposing: true });
    document.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();

    action.destroy?.();
  });

  it('suppresses repeated callbacks when holding key down, but prevents default', () => {
    const onEscape = vi.fn();
    const action = nuiEscapeAction(node, { onEscape, ignoreRepeat: true });

    // Initial press (repeat: false)
    const initialEvent = createKeyboardEvent('Escape', { repeat: false });
    document.dispatchEvent(initialEvent);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(initialEvent.preventDefault).toHaveBeenCalled();

    // Held down repeat press (repeat: true)
    const repeatEvent = createKeyboardEvent('Escape', { repeat: true });
    document.dispatchEvent(repeatEvent);
    expect(onEscape).toHaveBeenCalledTimes(1); // Not called again
    expect(repeatEvent.preventDefault).toHaveBeenCalled(); // Prevent default still called

    action.destroy?.();
  });

  it('re-binds listener when target changes in update()', () => {
    const onEscape = vi.fn();
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    // Initially attached to document
    const action = nuiEscapeAction(node, { onEscape, target: 'document' });

    // Update target to window
    action.update?.({ onEscape, target: 'window' });

    expect(removeEventListenerSpy).toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalled();

    // Dispatching on window should trigger onEscape
    const event = createKeyboardEvent('Escape');
    window.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalledTimes(1);

    action.destroy?.();
  });

  it('respects stopPropagation and stopImmediatePropagation when explicitly enabled', () => {
    const onEscape = vi.fn();
    const action = nuiEscapeAction(node, {
      onEscape,
      stopPropagation: true,
      stopImmediatePropagation: true
    });

    const event = createKeyboardEvent('Escape');
    document.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();

    action.destroy?.();
  });

  it('attaches to window directly and properly cleans up on destroy', () => {
    const onEscape = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const action = nuiEscapeAction(node, {
      onEscape,
      target: 'window'
    });

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function), expect.objectContaining({ capture: false }));

    const event = createKeyboardEvent('Escape');
    window.dispatchEvent(event);
    expect(onEscape).toHaveBeenCalledTimes(1);

    action.destroy?.();

    // After destruction via abort signal, window events should not invoke handler
    const eventAfterDestroy = createKeyboardEvent('Escape');
    window.dispatchEvent(eventAfterDestroy);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('skips execution when ignoreHandled is true and event was already defaultPrevented', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    // Handler 1 handles Escape and prevents default
    const action1 = nuiEscapeAction(node, {
      onEscape: (e) => {
        handler1();
        e.preventDefault();
      },
      preventDefault: true
    });

    // Handler 2 is configured with ignoreHandled: true
    const action2 = nuiEscapeAction(node, {
      onEscape: handler2,
      ignoreHandled: true
    });

    const event = createKeyboardEvent('Escape');
    document.dispatchEvent(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    action1.destroy?.();
    action2.destroy?.();
  });
});

describe('createEscapeHandler', () => {
  function createKeyboardEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
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

  it('evaluates enabled lazily on every keydown event', () => {
    let active = false;
    const onEscape = vi.fn();
    const handler = createEscapeHandler(() => ({
      onEscape,
      enabled: () => active
    }));

    // Inactive: should not fire
    const event1 = createKeyboardEvent('Escape');
    handler(event1);
    expect(onEscape).not.toHaveBeenCalled();

    // Dynamically activated: should fire
    active = true;
    const event2 = createKeyboardEvent('Escape');
    handler(event2);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('ignores IME composition (isComposing: true)', () => {
    const onEscape = vi.fn();
    const handler = createEscapeHandler(() => ({ onEscape }));

    const event = createKeyboardEvent('Escape', { isComposing: true });
    handler(event);

    expect(onEscape).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('suppresses repeat events when ignoreRepeat is true (default)', () => {
    const onEscape = vi.fn();
    const handler = createEscapeHandler(() => ({ onEscape }));

    // Initial press (repeat: false)
    const initialEvent = createKeyboardEvent('Escape', { repeat: false });
    handler(initialEvent);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(initialEvent.preventDefault).toHaveBeenCalled();

    // Held key repeat (repeat: true)
    const repeatEvent = createKeyboardEvent('Escape', { repeat: true });
    handler(repeatEvent);
    expect(onEscape).toHaveBeenCalledTimes(1); // not called again
    expect(repeatEvent.preventDefault).toHaveBeenCalled(); // still prevented
  });

  it('allows repeat events when ignoreRepeat is set to false', () => {
    const onEscape = vi.fn();
    const handler = createEscapeHandler(() => ({ onEscape, ignoreRepeat: false }));

    const repeatEvent = createKeyboardEvent('Escape', { repeat: true });
    handler(repeatEvent);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(repeatEvent.preventDefault).toHaveBeenCalled();
  });

  it('respects ignoreHandled when default is already prevented', () => {
    const onEscape = vi.fn();
    const handler = createEscapeHandler(() => ({ onEscape, ignoreHandled: true }));

    const event = createKeyboardEvent('Escape');
    event.preventDefault(); // simulated earlier handler

    handler(event);
    expect(onEscape).not.toHaveBeenCalled();
  });
});
