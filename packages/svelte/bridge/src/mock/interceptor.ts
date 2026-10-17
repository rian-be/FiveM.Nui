import { isNuiUrl, parseNuiUrl } from './url';

export interface InterceptorContext {
  targetResource: string;
  latencyMs: number;
  log: boolean;
  activeRequests: Record<string, (payload: any) => Promise<any> | any>;
  activeCallbacks: Record<string, (payload: any) => void>;
  activeSendHandlers: Record<string, (payload: any) => void>;
  originalFetch: typeof window.fetch;
}

/**
 * Extracts the body payload from a `fetch` invocation, supporting both `init.body`
 * and body text inside a `Request` instance.
 */
export async function extractRequestBody(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<any> {
  let bodyText = typeof init?.body === 'string' ? init.body : null;
  if (!bodyText && typeof Request !== 'undefined' && input instanceof Request) {
    try {
      bodyText = await input.clone().text();
    } catch {
      // body already consumed or unreadable
    }
  }

  if (bodyText) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return bodyText;
    }
  }
  return null;
}

/**
 * Creates the `window.fetch` interceptor function that simulates FiveM CEF transport.
 */
export function createFetchInterceptor(ctx: InterceptorContext): typeof window.fetch {
  const {
    targetResource,
    latencyMs,
    log,
    activeRequests,
    activeCallbacks,
    activeSendHandlers,
    originalFetch
  } = ctx;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!isNuiUrl(url, targetResource)) {
      return originalFetch(input, init);
    }

    const { resourceName, callbackName } = parseNuiUrl(url);
    const bodyObj = await extractRequestBody(input, init);

    const eventName = bodyObj?.event;
    const correlationId = bodyObj?.id;
    const payload = bodyObj?.payload ?? bodyObj?.data;
    const messageType = bodyObj?.type;

    if (log) {
      console.debug(
        `[NUI Mock] -> POST https://${resourceName}/${callbackName} type='${messageType ?? 'event'}' event='${eventName ?? callbackName}' id=${correlationId ?? '-'}`,
        payload
      );
    }

    // Simulate consistent transport latency across all NUI operations
    if (latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, latencyMs));
    }

    let handled = false;

    // Check callback notifications
    if (activeCallbacks[callbackName]) {
      handled = true;
      try {
        activeCallbacks[callbackName](payload);
      } catch (e) {
        console.error(`[NUI Mock] Error in callback handler '${callbackName}':`, e);
      }
    }

    // Check send handlers
    if (eventName && activeSendHandlers[eventName]) {
      handled = true;
      try {
        activeSendHandlers[eventName](payload);
      } catch (e) {
        console.error(`[NUI Mock] Error in send handler '${eventName}':`, e);
      }
    }

    // Handle correlated request/response
    if (eventName && activeRequests[eventName]) {
      handled = true;
      try {
        const result = await activeRequests[eventName](payload);

        // In FiveM CEF, HTTP POST to https://<resource>/<callback> is strictly an outgoing transport ACK;
        // the native C# backend delivers the correlated response envelope asynchronously via
        // SendNuiMessage -> window.postMessage.
        if (correlationId) {
          window.postMessage(
            {
              type: 'response',
              id: correlationId,
              success: true,
              payload: result,
              data: result
            },
            '*'
          );
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err: unknown) {
        const errorEnvelope = {
          code: (err as any)?.code ?? 'MOCK_ERROR',
          message: err instanceof Error ? err.message : String(err)
        };

        if (correlationId) {
          window.postMessage(
            {
              type: 'response',
              id: correlationId,
              success: false,
              error: errorEnvelope
            },
            '*'
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            error: errorEnvelope
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    if (!handled && log) {
      const targetEvent = eventName ?? callbackName;
      console.warn(
        `[NUI Mock] Unhandled NUI message: no mock handler registered for '${targetEvent}'.`
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
}
