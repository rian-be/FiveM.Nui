import type { NuiWindowAction } from '@fivem-nui/core';

/**
 * Message types for synthetic NUI postMessage envelopes in the mock environment.
 */
export enum NuiMessageType {
  /**
   * Standard event message.
   */
  Event = 'event',

  /**
   * RPC request message.
   */
  Request = 'request',

  /**
   * RPC response message.
   */
  Response = 'response'
}

/**
 * Configuration options for {@link setupNuiMock}.
 */
export interface NuiMockOptions {
  /**
   * Expected FiveM resource name to intercept.
   * If omitted, falls back to `getResourceName('')` or `'nui'`.
   */
  resourceName?: string;

  /**
   * Mock handlers for requests sent via `nui.request(eventName, payload)`.
   * Return the response payload or a Promise resolving to it.
   */
  requests?: Record<string, (payload: any) => Promise<any> | any>;

  /**
   * Mock callbacks registered with `nui.notify(callbackName, payload)`.
   */
  callbacks?: Record<string, (payload: any) => void>;

  /**
   * Listeners invoked when UI sends fire-and-forget messages (`nui.send`).
   */
  onSend?: Record<string, (payload: any) => void>;

  /**
   * Delay in milliseconds to simulate network latency in the browser.
   * @defaultValue 50
   */
  latencyMs?: number;

  /**
   * Whether to log mock events and requests in the browser console.
   * @defaultValue true
   */
  log?: boolean;
}

/**
 * Controller interface returned by {@link setupNuiMock} for controlling the mock runtime.
 */
export interface NuiMockController {
  /**
   * Simulates an event dispatched from C#/server to NUI.
   *
   * @param eventName - Name of the simulated event.
   * @param payload - Optional data payload.
   * @param delayMs - Optional delay in milliseconds before dispatching.
   */
  emitEvent(eventName: string, payload?: unknown, delayMs?: number): void;

  /**
   * Simulates a window lifecycle action (`'open'`, `'close'`, `'focus'`, `'blur'`).
   *
   * @param action - The window lifecycle action.
   * @param windowName - Optional target window identifier.
   * @param delayMs - Optional delay in milliseconds before dispatching.
   */
  emitWindow(action: NuiWindowAction, windowName?: string, delayMs?: number): void;

  /**
   * Dynamically adds or updates a request mock handler.
   *
   * @param eventName - RPC request event name to intercept.
   * @param handler - Handler function returning the mock response.
   * @returns Unsubscribe function to remove the mock handler.
   */
  mockRequest<TRequest = unknown, TResponse = unknown>(
    eventName: string,
    handler: (payload: TRequest) => Promise<TResponse> | TResponse
  ): () => void;

  /**
   * Removes a mock request handler.
   *
   * @param eventName - Name of the request to remove.
   */
  removeRequest(eventName: string): void;

  /**
   * Dynamically adds a listener for UI-sent messages (`nui.send`).
   *
   * @param eventName - Event name to listen for.
   * @param handler - Callback invoked with the sent payload.
   * @returns Unsubscribe function to remove the listener.
   */
  onSend<T = unknown>(eventName: string, handler: (payload: T) => void): () => void;

  /**
   * Restores original window.fetch and cleans up mock handlers.
   */
  destroy(): void;
}

export const NOOP_CONTROLLER: NuiMockController = {
  emitEvent: () => {},
  emitWindow: () => {},
  mockRequest: () => () => {},
  removeRequest: () => {},
  onSend: () => () => {},
  destroy: () => {}
};
