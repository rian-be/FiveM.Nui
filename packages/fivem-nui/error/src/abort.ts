/**
 * Checks whether an error represents an aborted asynchronous operation.
 * Matches standard DOMException AbortError, Fetch AbortError, or custom NuiRequestError with code 'ABORTED'.
 */
export function isAbortError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  try {
    const candidate = err as { name?: unknown; code?: unknown };
    return candidate.name === 'AbortError' || candidate.code === 'ABORTED';
  } catch {
    return false;
  }
}

/**
 * Creates an AbortError in an environment-agnostic way.
 * Uses global DOMException if available; falls back to Error with name 'AbortError' and code 'ABORTED'.
 */
export function createAbortError(message = 'The operation was aborted.'): Error | DOMException {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }
  const err = new Error(message);
  err.name = 'AbortError';
  (err as { code?: string }).code = 'ABORTED';
  return err;
}
