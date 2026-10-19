import {
  NuiErrorCategory,
  NuiErrorSeverity,
  type NuiErrorInfo,
  type GlobalErrorListenerOptions
} from './types';
import { globalErrorHandler } from './handler';
import { formatStackTrace } from './stacktrace';

/**
 * Standard keywords indicating DOM / component rendering or lifecycle failures.
 * Completely framework-agnostic.
 */
export const DEFAULT_RENDER_KEYWORDS = [
  'hydration',
  'lifecycle',
  'mount',
  'unmount',
  'render',
  'vnode',
  'shadowroot',
  'domexception'
];

/**
 * Default heuristic to determine whether an unhandled error originates from
 * UI rendering or component lifecycle without hardcoding framework names.
 */
export function defaultIsRenderError(error: unknown, message: string): boolean {
  const text = `${message} ${error instanceof Error ? error.stack || '' : ''}`.toLowerCase();
  return DEFAULT_RENDER_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Normalize an unknown error/reason into a proper Error object
 */
function toError(raw: unknown, defaultMessage: string): Error {
  if (raw instanceof Error) {
    return raw;
  }
  if (typeof raw === 'string') {
    return new Error(raw);
  }
  if (typeof raw === 'object' && raw !== null) {
    try {
      return new Error(JSON.stringify(raw));
    } catch {
      return new Error(defaultMessage);
    }
  }
  return new Error(defaultMessage);
}

/**
 * Installs global error and unhandled rejection listeners on `window`.
 *
 * Works completely framework-agnostic (Svelte, Vue, React, Solid, Vanilla JS).
 *
 * Captures:
 * - `window.onerror` / `window.addEventListener('error')` -> NuiErrorCategory.SCRIPT / RENDER
 * - `window.onunhandledrejection` / `window.addEventListener('unhandledrejection')` -> NuiErrorCategory.UNHANDLED_REJECTION
 *
 * @param options Listener configuration options
 * @returns Cleanup function to uninstall the listeners
 */
export function installGlobalErrorHandlers(
  options: GlobalErrorListenerOptions = {}
): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    // Non-browser or SSR environment - safe no-op
    return () => {};
  }

  const {
    handler = globalErrorHandler,
    captureWindowErrors = true,
    captureUnhandledRejections = true,
    preventConsoleLogging = false,
    filter,
    isRenderError: customIsRenderError,
    onCaptured
  } = options;

  const errorListener = (event: ErrorEvent): void => {
    try {
      if (filter && !filter(event.error || event.message, event)) {
        return;
      }

      if (preventConsoleLogging) {
        event.preventDefault();
      }

      const errorObj = toError(event.error, event.message || 'Script error');
      const formattedStack = formatStackTrace(event.error || errorObj);

      const isRender = customIsRenderError
        ? customIsRenderError(event.error, event)
        : defaultIsRenderError(event.error, event.message || '');

      const metadata: Partial<NuiErrorInfo> = {
        category: isRender ? NuiErrorCategory.RENDER : NuiErrorCategory.SCRIPT,
        severity: NuiErrorSeverity.ERROR,
        stack: formattedStack,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now()
      };

      const context: Record<string, unknown> = {
        colno: event.colno,
        lineno: event.lineno,
        filename: event.filename,
        isRender
      };

      handler
        .handle(errorObj, context, isRender ? 'render' : 'window.onerror', metadata)
        .then(result => {
          if (result && onCaptured) {
            onCaptured(result);
          }
        })
        .catch(err => {
          console.error('[NUI ErrorHandler] Failed to process window.onerror:', err);
        });
    } catch (e) {
      console.error('[NUI ErrorHandler] Unexpected exception inside error listener:', e);
    }
  };

  const rejectionListener = (event: PromiseRejectionEvent): void => {
    try {
      if (filter && !filter(event.reason, event)) {
        return;
      }

      if (preventConsoleLogging) {
        event.preventDefault();
      }

      const errorObj = toError(event.reason, 'Unhandled Promise Rejection');
      const formattedStack = formatStackTrace(event.reason || errorObj);

      const metadata: Partial<NuiErrorInfo> = {
        category: NuiErrorCategory.UNHANDLED_REJECTION,
        severity: NuiErrorSeverity.ERROR,
        stack: formattedStack,
        timestamp: Date.now()
      };

      const context: Record<string, unknown> = {
        rawReason: event.reason
      };

      handler
        .handle(errorObj, context, 'window.onunhandledrejection', metadata)
        .then(result => {
          if (result && onCaptured) {
            onCaptured(result);
          }
        })
        .catch(err => {
          console.error('[NUI ErrorHandler] Failed to process unhandledrejection:', err);
        });
    } catch (e) {
      console.error('[NUI ErrorHandler] Unexpected exception inside rejection listener:', e);
    }
  };

  if (captureWindowErrors) {
    window.addEventListener('error', errorListener);
  }

  if (captureUnhandledRejections) {
    window.addEventListener('unhandledrejection', rejectionListener);
  }

  return () => {
    if (captureWindowErrors) {
      window.removeEventListener('error', errorListener);
    }
    if (captureUnhandledRejections) {
      window.removeEventListener('unhandledrejection', rejectionListener);
    }
  };
}

/**
 * Universal helper to capture UI component rendering errors (e.g. Svelte boundaries, Vue, React, Solid)
 */
export async function captureRenderError(
  error: unknown,
  componentName?: string,
  extraContext?: Record<string, unknown>,
  handler: { handle: typeof globalErrorHandler.handle } = globalErrorHandler
): Promise<NuiErrorInfo | null> {
  const errorObj = toError(error, `Render error in <${componentName || 'UnknownComponent'} />`);
  const formattedStack = formatStackTrace(error);

  const metadata: Partial<NuiErrorInfo> = {
    category: NuiErrorCategory.RENDER,
    severity: NuiErrorSeverity.ERROR,
    stack: formattedStack,
    timestamp: Date.now()
  };

  const context: Record<string, unknown> = {
    component: componentName,
    ...extraContext
  };

  return handler.handle(
    errorObj,
    context,
    componentName ? `<${componentName} /> render` : 'render',
    metadata
  );
}