/**
 * A pending request awaiting a correlated response.
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>,
  /** Released whenever the request settles or is removed (e.g. abort listener). */
  cleanup?: () => void;
}

/**
 * Tracks in-flight requests by correlation ID, matching responses
 * to their Promise resolvers.
 *
 * Mirrors C# `ConcurrentRequestManager` same idea, same responsibilities:
 * register, resolve, reject, unregister, and reject all on dispose.
 */
export class RequestCoordinator {
  private pending = new Map<string, PendingRequest>();

  /** Store a pending request so a later response can resolve or reject it. */
  register(
    id: string,
    resolve: PendingRequest['resolve'],
    reject: PendingRequest['reject'],
    timeout: ReturnType<typeof setTimeout>,
    cleanup?: () => void,
  ): void {
    this.pending.set(id, { resolve, reject, timeout, cleanup });
  }

  /**
   * Resolve the request whose correlation ID matches.
   * @returns `true` if a matching request was found.
   */
  resolve(id: string, payload: unknown): boolean {
    const entry = this.pending.get(id);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timeout);
    entry.cleanup?.();
    this.pending.delete(id);
    entry.resolve(payload);
    return true;
  }

  /**
   * Reject the request whose correlation ID matches.
   * @returns `true` if a matching request was found.
   */
  reject(id: string, error: Error): boolean {
    const entry = this.pending.get(id);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timeout);
    entry.cleanup?.();
    this.pending.delete(id);
    entry.reject(error);
    return true;
  }

  /** Removes a request without resolving or rejecting it (error-path cleanup). */
  unregister(id: string): void {
    const entry = this.pending.get(id);
    if (entry) {
      clearTimeout(entry.timeout);
      entry.cleanup?.();
      this.pending.delete(id);
    }
  }

  /** Number of requests still awaiting a response. */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Rejects every outstanding request with the supplied error.
   * Called during `dispose()` so callers don't hang forever.
   * @returns the number of requests that were rejected.
   */
  rejectAll(error: Error): number {
    const entries = Array.from(this.pending.values());

    this.pending.clear();

    for (const entry of entries) {
      clearTimeout(entry.timeout);
      entry.cleanup?.();
      entry.reject(error);
    }

    return entries.length;
  }

  /** Generates a unique correlation ID for a new request. */
  static generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
