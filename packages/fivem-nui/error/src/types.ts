/**
 * Error Categories for FiveM NUI communication and UI runtime
 */
export enum NuiErrorCategory {
  NETWORK = 'NETWORK',
  TIMEOUT = 'TIMEOUT',
  CALLBACK = 'CALLBACK',
  VALIDATION = 'VALIDATION',
  SCRIPT = 'SCRIPT',
  UNHANDLED_REJECTION = 'UNHANDLED_REJECTION',
  RENDER = 'RENDER',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels
 */
export enum NuiErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * Extended error information
 */
export interface NuiErrorInfo {
  /** Error category */
  category: NuiErrorCategory;
  /** Error severity */
  severity: NuiErrorSeverity;
  /** Original error or message */
  error: Error | string;
  /** Timestamp of error */
  timestamp: number;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Operation or component that caused the error */
  operation?: string;
  /** Formatted stack trace */
  stack?: string;
  /** Source file / URL where error occurred */
  source?: string;
  /** Line number in source */
  lineno?: number;
  /** Column number in source */
  colno?: number;
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms (default: 1000) */
  baseDelay?: number;
  /** Max delay cap in ms (default: 10000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Jitter range in ms (default: 1000) */
  jitter?: number;
  /** Whether to retry on timeout (default: true) */
  retryOnTimeout?: boolean;
  /** Whether to retry on network errors (default: true) */
  retryOnNetworkError?: boolean;
  /** Custom retry conditions */
  shouldRetry?: (error: NuiErrorInfo) => boolean;
}

/**
 * Global error interceptor function
 */
export type ErrorInterceptor = (
  error: NuiErrorInfo
) => NuiErrorInfo | null | Promise<NuiErrorInfo | null>;

/**
 * Configuration options for installGlobalErrorHandlers
 */
export interface GlobalErrorListenerOptions {
  /**
   * Custom error handler instance.
   * If omitted, the globalErrorHandler singleton will be used.
   */
  handler?: {
    handle: (
      error: Error | string,
      context?: Record<string, unknown>,
      operation?: string,
      metadata?: Partial<NuiErrorInfo>
    ) => Promise<NuiErrorInfo | null>;
  };
  /**
   * Whether to capture window.onerror (unhandled script errors).
   * Default: true
   */
  captureWindowErrors?: boolean;
  /**
   * Whether to capture window.onunhandledrejection (unhandled promises).
   * Default: true
   */
  captureUnhandledRejections?: boolean;
  /**
   * If true, calls event.preventDefault() to suppress native browser logging.
   * Default: false (allows DevTools to still display native errors)
   */
  preventConsoleLogging?: boolean;
  /**
   * Filter predicate to ignore specific errors (e.g. ResizeObserver loop warnings).
   * Returning false prevents capturing the error.
   */
  filter?: (error: unknown, event: Event) => boolean;
  /**
   * Custom predicate to determine if a window error should be categorized as NuiErrorCategory.RENDER.
   * If omitted, default DOM / lifecycle heuristics are used.
   */
  isRenderError?: (error: unknown, event: ErrorEvent) => boolean;
  /**
   * Callback executed immediately whenever an error is captured and processed.
   */
  onCaptured?: (errorInfo: NuiErrorInfo) => void;
}