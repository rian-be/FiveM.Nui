import type { NuiLogger } from './logger';

/**
 * Options for the NUI bridge.
 */
export interface NuiClientOptions {
  /**
   * Resource name the NUI page is served from. Defaults to `GetParentResourceName()`.
   */
  resource?: string;
  /**
   * Name of the resource callback C# registered via `RegisterRawNuiCallback`.
   * Every outbound message is POSTed to `https://<resource>/<callback>`.
   */
  callback?: string;
  /**
   * Window name that `open`/`close` envelopes refer to. Passed straight
   * through to `onWindow`, so the UI can ignore other windows.
   */
  window?: string;
  /**
   * How long a single POST may take before it is aborted, in milliseconds.
   * The resource can stop answering at any time (restart, shutdown) and a raw
   * fetch without a deadline would leave the caller awaiting forever.
   */
  postTimeoutMs?: number;
  /**
   * Default deadline for {@link NuiClient.request}, in milliseconds.
   * Matches the C# `NuiOptions.DefaultTimeout` default of 30s.
   */
  requestTimeoutMs?: number;
  /**
   * Where diagnostics go. Defaults to the console; pass `nullNuiLogger` to
   * silence it entirely.
   */
  logger?: NuiLogger;
  /**
   * Injection seam for tests. Defaults to the global `fetch`.
   */
  fetch?: typeof fetch;
}

/**
 * Resolves the owning FiveM resource name from the ambient FiveM runtime.
 *
 * Falls back to `'unknown_resource'` when running outside a game context
 * (SSR, unit tests, build pipeline) so importing the package never throws.
 */
export function readResourceName(): string {
  if (typeof GetParentResourceName === 'function') {
    return GetParentResourceName();
  }

  return 'unknown_resource';
}
