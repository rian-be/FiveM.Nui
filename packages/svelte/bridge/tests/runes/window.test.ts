import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SvelteNuiClient } from '../../src/client';
import { setDefaultNuiClient, resetDefaultNuiClient } from '../../src/context';
import { useNuiWindow } from '../../src/runes/window.svelte';
import { globalErrorHandler } from '@fivem-nui/error';

describe('useNuiWindow rune', () => {
  let client: SvelteNuiClient;

  beforeEach(() => {
    client = new SvelteNuiClient({ autoInitialize: false });
    setDefaultNuiClient(client);
    globalErrorHandler.clearHistory();
  });

  afterEach(() => {
    client.destroy();
    resetDefaultNuiClient();
    globalErrorHandler.clearHistory();
    vi.restoreAllMocks();
  });

  it('manages window open, close, and toggle states', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const onFocusChange = vi.fn();
    const notifySpy = vi.spyOn(client, 'notify').mockImplementation(() => {});

    const win = useNuiWindow('hud', {
      client,
      initialVisible: false,
      onOpen,
      onClose,
      onFocusChange
    });

    expect(win.visible).toBe(false);
    expect(win.focused).toBe(false);

    // Open
    win.open();
    expect(win.visible).toBe(true);
    expect(win.focused).toBe(true);
    expect(notifySpy).toHaveBeenCalledWith('ready', { window: 'hud' });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledWith(true);

    // Open again when already open: no-op
    win.open();
    expect(onOpen).toHaveBeenCalledTimes(1);

    // Close
    win.close();
    expect(win.visible).toBe(false);
    expect(win.focused).toBe(false);
    expect(notifySpy).toHaveBeenCalledWith('close', { window: 'hud' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledWith(false);

    // Close again when already closed: no-op
    win.close();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Toggle
    win.toggle();
    expect(win.visible).toBe(true);
    win.toggle();
    expect(win.visible).toBe(false);
  });

  it('exposes readonly visible and focused properties driven by transitions', () => {
    const win = useNuiWindow('inventory', { client, closeOnEscape: true });
    expect(win.visible).toBe(false);
    expect(win.focused).toBe(false);

    win.open();
    expect(win.visible).toBe(true);
    expect(win.focused).toBe(true);

    win.close();
    expect(win.visible).toBe(false);
    expect(win.focused).toBe(false);
    win.destroy();
  });

  it('deduplicates callbacks and only triggers onOpen/onClose/onFocusChange on real state transitions', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const onFocusChange = vi.fn();
    const notifySpy = vi.spyOn(client, 'notify').mockImplementation(() => {});

    const win = useNuiWindow('dedup:win', {
      client,
      onOpen,
      onClose,
      onFocusChange
    });

    // 1. UI opens window
    win.open();
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledWith(true);
    expect(notifySpy).toHaveBeenCalledWith('ready', { window: 'dedup:win' });

    // 2. Backend echoes 'open' for already-opened window: must NOT call onOpen or onFocusChange again
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'open', event: 'dedup:win' }
      })
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1);

    // 3. Backend sends 'focus' when already focused: must NOT duplicate onFocusChange
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'focus', event: 'dedup:win' }
      })
    );
    expect(onFocusChange).toHaveBeenCalledTimes(1);

    // 4. Backend sends 'unfocus': focus changes to false
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'unfocus', event: 'dedup:win' }
      })
    );
    expect(win.focused).toBe(false);
    expect(onFocusChange).toHaveBeenCalledTimes(2);
    expect(onFocusChange).toHaveBeenLastCalledWith(false);

    // 5. Backend sends 'unfocus' again when already unfocused: no-op
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'unfocus', event: 'dedup:win' }
      })
    );
    expect(onFocusChange).toHaveBeenCalledTimes(2);

    // 6. UI closes window: visible transitions to false, but focus was already false
    win.close();
    expect(onClose).toHaveBeenCalledTimes(1);
    // Focus was already false, so onFocusChange is not called again
    expect(onFocusChange).toHaveBeenCalledTimes(2);

    // 7. Backend echoes 'close' when already closed: no-op
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'close', event: 'dedup:win' }
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    win.destroy();
  });

  it('isolates callback exceptions so onOpen/onClose/onFocusChange errors do not break transitions or listeners', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onFocusChange = vi.fn();
    const win = useNuiWindow('error:win', {
      client,
      onOpen: () => {
        throw new Error('onOpen callback failed');
      },
      onFocusChange
    });

    // Opening window must execute onFocusChange even if onOpen threw
    expect(() => win.open()).not.toThrow();
    expect(win.visible).toBe(true);
    expect(win.focused).toBe(true);
    expect(onFocusChange).toHaveBeenCalledWith(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'onOpen callback failed' }));

    consoleErrorSpy.mockRestore();
    win.destroy();
  });

  it('supports initialVisible semantics without sending ready to backend or invoking onOpen', () => {
    const onOpen = vi.fn();
    const notifySpy = vi.spyOn(client, 'notify').mockImplementation(() => {});

    const win = useNuiWindow('initial:win', {
      client,
      initialVisible: true,
      closeOnEscape: true,
      onOpen
    });

    expect(win.visible).toBe(true);
    expect(win.focused).toBe(false);
    // Neither backend notification nor onOpen callback is fired during construction
    expect(notifySpy).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();

    // Escape still triggers close and notifies backend
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(escapeEvent);
    expect(win.visible).toBe(false);
    expect(notifySpy).toHaveBeenCalledWith('close', { window: 'initial:win' });

    win.destroy();
  });

  it('calling open() on a window with initialVisible: true notifies backend ready and gains focus without re-triggering onOpen', () => {
    const onOpen = vi.fn();
    const onFocusChange = vi.fn();
    const notifySpy = vi.spyOn(client, 'notify').mockImplementation(() => {});

    const win = useNuiWindow('already_visible:win', {
      client,
      initialVisible: true,
      onOpen,
      onFocusChange
    });

    expect(win.visible).toBe(true);
    expect(win.focused).toBe(false);

    // Call open() on already visible window
    win.open();

    // Notifies backend of ready because window transitioned to focused: true
    expect(notifySpy).toHaveBeenCalledWith('ready', { window: 'already_visible:win' });
    // onFocusChange is triggered (false -> true)
    expect(onFocusChange).toHaveBeenCalledWith(true);
    // onOpen is NOT triggered because visibility did not transition (was already true)
    expect(onOpen).not.toHaveBeenCalled();

    win.destroy();
  });

  it('supports destroy() method and ensures idempotent cleanup for escape and window listeners', () => {
    const unsubSpy = vi.fn();
    vi.spyOn(client, 'onWindow').mockReturnValueOnce(unsubSpy);

    const win = useNuiWindow('cleanup:win', {
      client,
      initialVisible: true,
      closeOnEscape: true,
      autoDestroy: false
    });

    win.destroy();
    win.destroy();
    expect(unsubSpy).toHaveBeenCalledTimes(1);

    // Escape listener removed
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const preventSpy = vi.spyOn(escapeEvent, 'preventDefault');
    window.dispatchEvent(escapeEvent);
    expect(preventSpy).not.toHaveBeenCalled();

    // Backend events ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'open', event: 'cleanup:win' }
      })
    );
    expect(win.visible).toBe(true); // was initially true, not modified after destroy
  });

  it('enforces strict component lifecycle error when autoDestroy: true is used outside a component and cleans up listeners', () => {
    const unsubSpy = vi.fn();
    vi.spyOn(client, 'onWindow').mockReturnValueOnce(unsubSpy);

    expect(() => {
      useNuiWindow('strict:win', { client, autoDestroy: true });
    }).toThrow(/lifecycle/);

    // Ensures listener was immediately cleaned up so no leak occurs
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });

  it('synchronizes with backend onWindow events and ignores different window names', () => {
    const win = useNuiWindow('inventory', { client });

    // Other window event: ignored
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'open', event: 'other_window' }
      })
    );
    expect(win.visible).toBe(false);

    // C# sends 'open'
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'open', event: 'inventory' }
      })
    );
    expect(win.visible).toBe(true);
    expect(win.focused).toBe(true);

    // C# sends 'unfocus'
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'unfocus', event: 'inventory' }
      })
    );
    expect(win.focused).toBe(false);
    expect(win.visible).toBe(true);

    // C# sends 'focus'
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'focus', event: 'inventory' }
      })
    );
    expect(win.focused).toBe(true);

    // C# sends 'close'
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'close', event: 'inventory' }
      })
    );
    expect(win.visible).toBe(false);
    win.destroy();
  });

  it('closes on Escape key press when visible and closeOnEscape is true', () => {
    const win = useNuiWindow('settings', { client, initialVisible: true, closeOnEscape: true });
    expect(win.visible).toBe(true);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    vi.spyOn(escapeEvent, 'preventDefault');
    window.dispatchEvent(escapeEvent);

    expect(escapeEvent.preventDefault).toHaveBeenCalled();
    expect(win.visible).toBe(false);
    win.destroy();
  });

  it('captures useNuiWindow notify failures into globalErrorHandler', () => {
    vi.spyOn(client, 'notify').mockImplementation(() => {
      throw new Error('Failed to notify backend');
    });

    const win = useNuiWindow('modal:hud', { client });
    win.open();

    const history = globalErrorHandler.getErrorHistory();
    const notifyErr = history.find((e) => e.operation === 'useNuiWindow:notify');
    expect(notifyErr).toBeDefined();
    expect(notifyErr?.context).toMatchObject({ window: 'modal:hud' });
  });
});
