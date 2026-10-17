import type { NuiMessage } from '../types';

/** A single POST the client attempted, recorded instead of being sent. */
export interface CapturedPost {
  url: string;
  body: NuiMessage;
}

/** Handle to the traffic captured during one `fakeFetch` session. */
export interface FakeFetch {
  /**
   * Drop-in `fetch` replacement. Pass it as `NuiClientOptions.fetch`.
   */
  impl: typeof fetch;
  /** Every POST recorded so far, in the order the client made them. */
  posts: CapturedPost[];
  /** Make every subsequent POST never settle until `release` is called. */
  hang(): void;
  /** Return to answering every POST immediately. */
  release(): void;
  /** The most recent POST, or `undefined` when nothing has been sent. */
  last(): CapturedPost | undefined;
}

/**
 * Builds a fake `fetch` that records POSTs instead of sending them.
 *
 * Tests can inspect what the client sent or drive failure paths by making the
 * resource hang. The hang path honours the caller's `AbortSignal`, because that
 * is the only way the client can ever give up on a POST.
 */
export function fakeFetch(): FakeFetch {
  const posts: CapturedPost[] = [];
  let hang = false;

  const impl = (input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((resolve, reject) => {
      posts.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as NuiMessage,
      });

      if (!hang) {
        resolve(new Response('{}', { status: 200 }));
        return;
      }

      init?.signal?.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError')),
      );
    });

  return {
    impl: impl as unknown as typeof fetch,
    posts,
    hang: () => {
      hang = true;
    },
    release: () => {
      hang = false;
    },
    last: () => posts[posts.length - 1],
  };
}
