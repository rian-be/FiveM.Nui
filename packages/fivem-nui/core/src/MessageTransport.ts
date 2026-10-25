import { NuiErrorCodes, NuiRequestError } from './errors';
import type { NuiLogger } from './logger';
import type { NuiMessage } from './types';

export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * HTTP transport for FiveM NUI.
 *
 * Posts envelopes to `https://<resource>/<callback>` using `fetch`.
 * Each POST is bounded by an `AbortController` deadline so a resource
 * that stops answering (restart, shutdown) does not hang the page forever.
 *
 * Mirrors C# `FiveMNuiTransport`.
 */
export class MessageTransport {
  private readonly resource: string;
  private readonly callbackName: string;
  private readonly postTimeoutMs: number;
  private readonly logger: NuiLogger;
  private readonly fetchImpl: FetchImpl;

  constructor(
    resource: string,
    callbackName: string,
    postTimeoutMs: number,
    logger: NuiLogger,
    fetchImpl: FetchImpl,
  ) {
    this.resource = resource;
    this.callbackName = callbackName;
    this.postTimeoutMs = postTimeoutMs;
    this.logger = logger;
    this.fetchImpl = fetchImpl;
  }

  /** URL of the main resource callback. */
  get mainCallbackUrl(): string {
    return `https://${this.resource}/${encodeURIComponent(this.callbackName)}`;
  }

  /** Builds the URL for an arbitrary callback on the same resource. */
  callbackUrl(callbackName: string): string {
    return `https://${this.resource}/${encodeURIComponent(callbackName)}`;
  }

  /**
   * Raw POST to `url` with the configured timeout deadline.
   *
   * @throws {NuiRequestError} with code `POST_TIMEOUT` when the resource
   *   stops answering within `postTimeoutMs`.
   * @throws {NuiRequestError} with code `TRANSPORT` for any other failure.
   */
  async post(url: string, body: unknown): Promise<void> {
    // Without an abort, a resource that stops answering leaves this promise
    // pending forever and the caller's await never returns.
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), this.postTimeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new NuiRequestError(
          NuiErrorCodes.Transport,
          `POST ${url} failed with HTTP ${response.status}`,
        );
      }
    } catch (error) {
      // A timeout abort surfaces as an error whose `name` is 'AbortError'.
      // In browsers that is a DOMException, but some fetch polyfills throw a
      // plain Error, so match on the name instead of the constructor. Checking
      // only `controller.signal.aborted` is unsafe: a race between the deadline
      // firing and an unrelated network error would misclassify the network
      // error as POST_TIMEOUT.
      const isAbortError = (error as { name?: string } | null)?.name === 'AbortError';

      if (isAbortError) {
        throw new NuiRequestError(
          NuiErrorCodes.PostTimeout,
          `POST ${url} timed out after ${this.postTimeoutMs}ms`,
        );
      }

      if (error instanceof NuiRequestError) throw error;
      throw new NuiRequestError(NuiErrorCodes.Transport, String(error));
    } finally {
      clearTimeout(deadline);
    }
  }
}
