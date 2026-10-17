import { onDestroy } from 'svelte';
import type { NuiWindowAction } from '@fivem-nui/core';
import { globalErrorHandler } from '@fivem-nui/error';
import type { SvelteNuiClient } from '../client';
import { useNuiClient } from '../context';

/**
 * Window lifecycle actions dispatched from C# backend to NUI UI.
 */
export enum NuiWindowActionType {
  Open = 'open',
  Close = 'close',
  Focus = 'focus',
  Unfocus = 'unfocus'
}

/**
 * Window lifecycle notifications dispatched from UI to C# backend.
 */
export enum NuiWindowNotification {
  Ready = 'ready',
  Close = 'close'
}

export interface NuiWindowOptions {
  /**
   * Explicit client instance override.
   * Defaults to the client provided via context (`useNuiClient()`) or global client.
   */
  client?: SvelteNuiClient;

  /**
   * Initial visibility without focus or backend notification.
   * @defaultValue false
   */
  initialVisible?: boolean;

  /**
   * Automatically closes the window when Escape is pressed.
   * @defaultValue true
   */
  closeOnEscape?: boolean;

  /**
   * Callback invoked when window visibility changes from hidden to visible.
   */
  onOpen?: () => void;

  /**
   * Callback invoked when window visibility changes from visible to hidden.
   */
  onClose?: () => void;

  /**
   * Callback invoked when window focus state changes.
   */
  onFocusChange?: (focused: boolean) => void;

  /**
   * Controls automatic cleanup through Svelte's component lifecycle.
   *
   * - `true`: Strictly requires component initialization lifecycle; throws if called outside.
   * - `false`: Disables automatic lifecycle cleanup; call `destroy()` manually.
   * - `undefined`: Attempts automatic cleanup, falling back to manual cleanup outside components.
   *
   * @defaultValue undefined
   */
  autoDestroy?: boolean;
}

/**
 * Controller interface representing a reactive NUI window.
 */
export interface NuiWindow {
  /** Whether the window is currently visible. */
  readonly visible: boolean;

  /** Whether the window currently has input focus. */
  readonly focused: boolean;

  /** Opens the window, sets focused to true, and sends a 'ready' notification to C#. */
  open(): void;

  /** Closes the window, clears focus, and sends a 'close' notification to C#. */
  close(): void;

  /** Toggles window visibility between open and closed. */
  toggle(): void;

  /** Destroys the window controller, unsubscribing from C# window events and key listeners. */
  destroy(): void;
}

function safeCallback<TArgs extends unknown[]>(
  operation: string,
  callback: ((...args: TArgs) => void) | undefined,
  ...args: TArgs
): void {
  if (!callback) return;

  try {
    callback(...args);
  } catch (error) {
    void globalErrorHandler
      .handle(
        error instanceof Error ? error : new Error(String(error)),
        { args },
        operation
      )
      .catch(() => {});
    console.error(error);
  }
}

/**
 * Controller managing reactive visibility, focus, and backend events for a named NUI window.
 */
export class NuiWindowController implements NuiWindow {
  visible = $state(false);
  focused = $state(false);

  private destroyed = false;
  private listeningForEscape = false;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly windowName: string,
    private readonly options: NuiWindowOptions = {},
    private readonly client: SvelteNuiClient
  ) {
    this.visible = options.initialVisible ?? false;
    this.unsubscribe = client.onWindow(this.handleWindowAction);

    if (this.visible) {
      this.syncEscapeListener(true);
    }
  }

  private syncEscapeListener(shouldListen: boolean): void {
    if (typeof window === 'undefined' || this.options.closeOnEscape === false) return;
    if (this.listeningForEscape === shouldListen) return;

    if (shouldListen) {
      window.addEventListener('keydown', this.handleEscape);
    } else {
      window.removeEventListener('keydown', this.handleEscape);
    }

    this.listeningForEscape = shouldListen;
  }

  private handleEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.visible || this.destroyed) return;

    event.preventDefault();
    this.close();
  };

  private transition(
    nextVisible?: boolean,
    nextFocused?: boolean
  ): { visibility: boolean; focus: boolean } {
    const changes = {
      visibility: nextVisible !== undefined && this.visible !== nextVisible,
      focus: nextFocused !== undefined && this.focused !== nextFocused
    };

    if (nextVisible !== undefined && changes.visibility) {
      this.visible = nextVisible;
      this.syncEscapeListener(nextVisible);
    }

    if (nextFocused !== undefined && changes.focus) {
      this.focused = nextFocused;
    }

    return changes;
  }

  private notifyAndDispatch(
    changes: { visibility: boolean; focus: boolean },
    notification?: NuiWindowNotification
  ): void {
    if (notification && (changes.visibility || changes.focus)) {
      try {
        this.client.notify(notification, { window: this.windowName });
      } catch (error) {
        void globalErrorHandler
          .handle(
            error instanceof Error ? error : new Error(String(error)),
            { window: this.windowName, notification },
            'useNuiWindow:notify'
          )
          .catch(() => {});
        console.error('[NuiWindow] Failed to dispatch notify to backend:', error);
      }
    }

    if (changes.visibility) {
      safeCallback('useNuiWindow:visibility', this.visible ? this.options.onOpen : this.options.onClose);
    }

    if (changes.focus) {
      safeCallback('useNuiWindow:focus', this.options.onFocusChange, this.focused);
    }
  }

  open = (): void => {
    if (this.destroyed) return;

    const changes = this.transition(true, true);
    this.notifyAndDispatch(changes, NuiWindowNotification.Ready);
  };

  close = (): void => {
    if (this.destroyed) return;

    const changes = this.transition(false, false);
    this.notifyAndDispatch(changes, NuiWindowNotification.Close);
  };

  toggle = (): void => {
    if (this.destroyed) return;

    if (this.visible) this.close();
    else this.open();
  };

  private handleWindowAction = (
    action: NuiWindowAction,
    targetWindow: string | undefined
  ): void => {
    if (this.destroyed || (targetWindow && targetWindow !== this.windowName)) {
      return;
    }

    switch (action) {
      case NuiWindowActionType.Open:
        this.notifyAndDispatch(this.transition(true, true));
        break;

      case NuiWindowActionType.Close:
        this.notifyAndDispatch(this.transition(false, false));
        break;

      case NuiWindowActionType.Focus:
        if (this.visible) {
          this.notifyAndDispatch(this.transition(undefined, true));
        }
        break;

      case NuiWindowActionType.Unfocus:
        this.notifyAndDispatch(this.transition(undefined, false));
        break;
    }
  };

  destroy = (): void => {
    if (this.destroyed) return;

    this.destroyed = true;
    this.syncEscapeListener(false);
    this.unsubscribe();
  };
}

/**
 * Reactive controller for a named NUI window.
 * Synchronizes visibility and focus states with the FiveM C# backend.
 *
 * @param windowName - Window identifier matching backend events.
 * @param options - Optional configuration (callbacks, Escape handling).
 *
 * @example
 * ```svelte
 * <script>
 *   import { useNuiWindow } from '@fivem-nui/svelte';
 *
 *   const win = useNuiWindow('inventory', { closeOnEscape: true });
 * </script>
 *
 * {#if win.visible}
 *   <div class="panel">
 *     <button onclick={() => win.close()}>Close</button>
 *   </div>
 * {/if}
 * ```
 */
export function useNuiWindow(
  windowName: string,
  options: NuiWindowOptions = {}
): NuiWindow {
  const client = options.client ?? useNuiClient();
  const controller = new NuiWindowController(windowName, options, client);

  if (options.autoDestroy !== false) {
    try {
      onDestroy(controller.destroy);
    } catch (error) {
      if (options.autoDestroy === true) {
        controller.destroy();
        throw error;
      }
    }
  }

  return controller;
}