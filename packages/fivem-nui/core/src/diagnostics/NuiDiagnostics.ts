/**
 * Counter snapshot exposed by {@link NuiClient.getDiagnostics}.
 *
 * Mirrors the C# `NuiDiagnosticsSnapshot` so both sides of the bridge can be
 * inspected with the same vocabulary.
 */
export interface NuiDiagnostics {
  /** Envelopes POSTed to the main resource callback. */
  sent: number;
  /** Envelopes POSTed to a named callback (`notify`, `notifyAndWait`). */
  notified: number;
  /** POSTs that failed or timed out. */
  failed: number;
  /** Messages received from C#, any type. */
  received: number;
  /** Requests that resolved successfully. */
  resolved: number;
  /** Requests rejected by C# or by a timeout. */
  rejected: number;
  /** Requests still awaiting a response. */
  pending: number;
  /** Registered event listeners, across all events. */
  listeners: number;
  /** Registered C#-request handlers. */
  callbacks: number;
  /** Window lifecycle listeners. */
  windowListeners: number;
}
