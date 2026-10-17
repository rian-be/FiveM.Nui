import type { NuiWindowAction } from '@fivem-nui/core';
import { isNui, getResourceName } from '../utils/env';
import {
  type NuiMockOptions,
  type NuiMockController,
  NuiMessageType,
  NOOP_CONTROLLER
} from './types';
import { createFetchInterceptor } from './interceptor';

export { NuiMessageType };
export type { NuiMockOptions, NuiMockController };
export { isNuiUrl, parseNuiUrl } from './url';
export { createFetchInterceptor, extractRequestBody } from './interceptor';

/**
 * Sets up a browser mock environment for FiveM NUI.
 *
 * Intercepts POST requests sent to `https://<resource>/<callback>` and
 * responds with mock data when running outside FiveM CEF.
 *
 * @param options - Configuration options for the mock environment.
 * @returns Controller for emitting simulated events and registering dynamic mocks.
 *
 * @example
 * ```ts
 * import { setupNuiMock } from '@fivem-nui/svelte';
 *
 * const mock = setupNuiMock({
 *   requests: {
 *     getPlayerData: () => ({ id: 1, name: 'John Doe' })
 *   }
 * });
 * ```
 */
export function setupNuiMock(options: NuiMockOptions = {}): NuiMockController {
  const {
    requests = {},
    callbacks = {},
    onSend: sendHandlers = {},
    latencyMs = 50,
    log = true,
    resourceName: customResource
  } = options;

  // 1. SSR check first to avoid referencing window when unavailable
  if (typeof window === 'undefined') {
    return NOOP_CONTROLLER;
  }

  // 2. In CEF FiveM, the mock interceptor must remain disabled
  if (isNui()) {
    if (log) {
      console.info('[fivem-nui-svelte] Running inside FiveM CEF - mock interceptor disabled.');
    }
    return NOOP_CONTROLLER;
  }

  // 3. Clean up any previously active mock instance (e.g. on Vite HMR reload)
  if ((window as any).__nuiMock && typeof (window as any).__nuiMock.destroy === 'function') {
    (window as any).__nuiMock.destroy();
  }

  const targetResource = customResource || getResourceName('') || 'nui';
  const activeRequests: Record<string, (payload: any) => Promise<any> | any> = { ...requests };
  const activeCallbacks: Record<string, (payload: any) => void> = { ...callbacks };
  const activeSendHandlers: Record<string, (payload: any) => void> = { ...sendHandlers };

  const originalFetch = window.fetch;

  function emitEvent(eventName: string, payload?: unknown, delayMs?: number): void {
    const dispatch = () => {
      if (log) {
        console.debug(`[NUI Mock] <- EVENT '${eventName}'`, payload);
      }
      window.postMessage(
        {
          type: NuiMessageType.Event,
          event: eventName,
          payload,
          // 'data' preserved alongside 'payload' for backward compatibility with legacy scripts
          data: payload
        },
        '*'
      );
    };

    if (delayMs && delayMs > 0) {
      setTimeout(dispatch, delayMs);
    } else {
      dispatch();
    }
  }

  function emitWindow(action: NuiWindowAction, windowName?: string, delayMs?: number): void {
    const dispatch = () => {
      if (log) {
        console.debug(`[NUI Mock] <- WINDOW action='${action}' window='${windowName ?? '*'}'`);
      }
      window.postMessage(
        {
          type: action,
          event: windowName,
          action,
          window: windowName
        },
        '*'
      );
    };

    if (delayMs && delayMs > 0) {
      setTimeout(dispatch, delayMs);
    } else {
      dispatch();
    }
  }

  const interceptedFetch = createFetchInterceptor({
    targetResource,
    latencyMs,
    log,
    activeRequests,
    activeCallbacks,
    activeSendHandlers,
    originalFetch
  });

  window.fetch = interceptedFetch;

  const controller: NuiMockController = {
    emitEvent,
    emitWindow,
    mockRequest<TRequest = unknown, TResponse = unknown>(
      eventName: string,
      handler: (payload: TRequest) => Promise<TResponse> | TResponse
    ) {
      activeRequests[eventName] = handler;
      return () => {
        if (activeRequests[eventName] === handler) {
          delete activeRequests[eventName];
        }
      };
    },
    removeRequest(eventName: string) {
      delete activeRequests[eventName];
    },
    onSend<T = unknown>(eventName: string, handler: (payload: T) => void) {
      activeSendHandlers[eventName] = handler;
      return () => {
        if (activeSendHandlers[eventName] === handler) {
          delete activeSendHandlers[eventName];
        }
      };
    },
    destroy() {
      if (typeof window !== 'undefined') {
        if (window.fetch === interceptedFetch) {
          window.fetch = originalFetch;
        }
        if ((window as any).__nuiMock === controller) {
          delete (window as any).__nuiMock;
        }
      }
    }
  };

  (window as any).__nuiMock = controller;

  if (log) {
    console.info(
      `[fivem-nui-svelte] Mock interceptor active for resource '${targetResource}'. window.__nuiMock ready.`
    );
  }

  return controller;
}
