import { describe, it, expect, vi } from 'vitest';
import { nuiLayer, NuiLayerDismissReason } from '../../src/actions/layer';
import { nuiEscapeAction, NuiEscapeTarget } from '../../src/actions/escape';
import { nuiClickOutside } from '../../src/actions/clickOutside';
import { useNuiKey, useNuiEscape, NuiSpecialKey } from '../../src/utils/keyboard';

describe('Bridge Enums & Callback Safety', () => {
  it('supports NuiLayerDismissReason enum and protects against callback exceptions', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);

    const dismissedReasons: string[] = [];
    const action = nuiLayer(container, {
      onDismiss: (reason) => {
        dismissedReasons.push(reason);
        throw new Error('Explosion in onDismiss');
      }
    });

    // Top layer triggers escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dismissedReasons).toEqual([NuiLayerDismissReason.Escape]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NuiLayer] Error in onEscape/onDismiss callback:'),
      expect.any(Error)
    );

    // Top layer triggers outside click
    document.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    expect(dismissedReasons).toEqual([NuiLayerDismissReason.Escape, NuiLayerDismissReason.Outside]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NuiLayer] Error in onClickOutside/onDismiss callback:'),
      expect.any(Error)
    );

    action.destroy();
    container.remove();
  });

  it('supports NuiEscapeTarget enum and protects against onEscape callback exceptions', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);

    let called = false;
    const action = nuiEscapeAction(container, {
      target: NuiEscapeTarget.Document,
      onEscape: () => {
        called = true;
        throw new Error('Explosion in onEscape');
      }
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(called).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NuiEscape] Error in onEscape callback:'),
      expect.any(Error)
    );

    action.destroy();
    container.remove();
  });

  it('protects against onClickOutside callback exceptions', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);

    let called = false;
    const action = nuiClickOutside(container, {
      onClickOutside: () => {
        called = true;
        throw new Error('Explosion in onClickOutside');
      }
    });

    document.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
    expect(called).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NuiClickOutside] Error in onClickOutside callback:'),
      expect.any(Error)
    );

    action.destroy();
    container.remove();
  });

  it('supports useNuiKey with autoDestroy options and isolates callback exceptions', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Outside component lifecycle with autoDestroy: true should clean up and throw
    expect(() => {
      useNuiKey('k', () => {}, { autoDestroy: true });
    }).toThrow();

    // With autoDestroy: false or undefined, should succeed and allow manual cleanup
    let keyHits = 0;
    const cleanup = useNuiKey(
      'k',
      () => {
        keyHits++;
        throw new Error('Explosion in key handler');
      },
      { autoDestroy: false }
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(keyHits).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[NuiKey] Error in key handler callback:'),
      expect.any(Error)
    );

    // Calling cleanup removes listener
    cleanup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(keyHits).toBe(1);

    // useNuiEscape uses NuiSpecialKey.Escape
    let escapeHits = 0;
    const escCleanup = useNuiEscape(() => {
      escapeHits++;
    }, { autoDestroy: false });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: NuiSpecialKey.Escape }));
    expect(escapeHits).toBe(1);
    escCleanup();
  });
});
