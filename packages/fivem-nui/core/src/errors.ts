import type { NuiError } from './types';

/**
 * Error codes produced by the C# side and by this bridge.
 *
 * The C# client answers with `UNKNOWN_CALLBACK` for an event nobody registered
 * and times requests out; keeping the codes in one place means callers can
 * branch on them instead of matching on message text.
 */
export const NuiErrorCodes = {
  /** C# has no handler registered for the requested event. */
  UnknownCallback: 'UNKNOWN_CALLBACK',
  /** The handler exists but threw. */
  CallbackError: 'CALLBACK_ERROR',
  /** No response arrived before the request deadline. */
  Timeout: 'TIMEOUT',
  /** The caller aborted the request through its `AbortSignal`. */
  Aborted: 'ABORTED',
  /** The POST to the resource did not complete in time. */
  PostTimeout: 'POST_TIMEOUT',
  /** The resource stopped answering (restart, shutdown, unload). */
  Transport: 'TRANSPORT',
  /** `dispose()` was called while requests were still in flight. */
  Disposed: 'DISPOSED',
  /** Fallback when the C# side reported a failure without a code. */
  Unknown: 'UNKNOWN_ERROR',
} as const;

export type NuiErrorCode = (typeof NuiErrorCodes)[keyof typeof NuiErrorCodes];

/**
 * Error thrown by every rejected operation on the bridge.
 *
 * `code` is the machine-readable part; `message` stays human-readable for logs.
 */
export class NuiRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'NuiRequestError';
    this.code = code;
  }

  /** Rebuilds an error from an error envelope received from C#. */
  static fromEnvelope(error: NuiError | undefined): NuiRequestError {
    if (!error) {
      return new NuiRequestError(NuiErrorCodes.Unknown, 'C# reported a failure without details');
    }

    return new NuiRequestError(error.code || NuiErrorCodes.Unknown, error.message || 'Unknown error');
  }
}

/** Narrowing helper for `catch` blocks. */
export function isNuiRequestError(value: unknown): value is NuiRequestError {
  return value instanceof NuiRequestError;
}