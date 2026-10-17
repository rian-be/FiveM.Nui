import {
  NuiErrorCategory,
  NuiErrorSeverity,
  type NuiErrorInfo,
  type RetryOptions,
  type ErrorInterceptor
} from './types.js';
import { formatStackTrace } from './stacktrace.js';

/**
 * Error handler with retry logic and global interceptors
 */
export class NuiErrorHandler {
  private interceptors: ErrorInterceptor[] = [];
  private errorHistory: NuiErrorInfo[] = [];
  private maxHistorySize: number = 100;

  /**
   * Add a global error interceptor
   */
  addInterceptor(interceptor: ErrorInterceptor): () => void {
    this.interceptors.push(interceptor);
    return () => {
      const index = this.interceptors.indexOf(interceptor);
      if (index > -1) this.interceptors.splice(index, 1);
    };
  }

  /**
   * Remove an interceptor
   */
  removeInterceptor(interceptor: ErrorInterceptor): boolean {
    const index = this.interceptors.indexOf(interceptor);
    if (index > -1) {
      this.interceptors.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get error history
   */
  getErrorHistory(): NuiErrorInfo[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Handle and categorize an error
   */
  async handle(
    error: Error | string,
    context?: Record<string, unknown>,
    operation?: string,
    metadata?: Partial<NuiErrorInfo>
  ): Promise<NuiErrorInfo | null> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const formattedStack = metadata?.stack || formatStackTrace(errorObj);

    const errorInfo: NuiErrorInfo = {
      category: metadata?.category || this.categorizeError(errorObj),
      severity: metadata?.severity || NuiErrorSeverity.ERROR,
      error: errorObj,
      timestamp: metadata?.timestamp || Date.now(),
      context,
      operation,
      stack: formattedStack,
      source: metadata?.source,
      lineno: metadata?.lineno,
      colno: metadata?.colno
    };

    // Add to history
    this.errorHistory.push(errorInfo);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Run interceptors
    for (const interceptor of this.interceptors) {
      const result = await interceptor(errorInfo);
      if (result === null) return null; // Error was handled/suppressed
      Object.assign(errorInfo, result);
    }

    return errorInfo;
  }

  /**
   * Categorize an error based on its type/message
   */
  categorizeError(error: Error | string): NuiErrorCategory {
    const message = typeof error === 'string' ? error : error.message || '';
    const name = typeof error === 'object' && error !== null && 'name' in error ? (error as any).name : '';

    if (
      message.includes('ECONNREFUSED') ||
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('network') ||
      name === 'NetworkError'
    ) {
      return NuiErrorCategory.NETWORK;
    }

    if (
      message.includes('timeout') ||
      message.includes('TIMEOUT') ||
      name === 'TimeoutError'
    ) {
      return NuiErrorCategory.TIMEOUT;
    }

    if (
      message.includes('callback') ||
      message.includes('CALLBACK') ||
      message.includes('InvokeNative')
    ) {
      return NuiErrorCategory.CALLBACK;
    }

    if (
      message.includes('validation') ||
      message.includes('VALIDATION') ||
      name === 'ValidationError' ||
      name === 'ZodError'
    ) {
      return NuiErrorCategory.VALIDATION;
    }

    if (
      name === 'TypeError' ||
      name === 'ReferenceError' ||
      name === 'SyntaxError'
    ) {
      return NuiErrorCategory.SCRIPT;
    }

    return NuiErrorCategory.UNKNOWN;
  }

  /**
   * Retry with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      backoffFactor = 2,
      jitter = 1000,
      retryOnTimeout = true,
      retryOnNetworkError = true,
      shouldRetry
    } = options;

    let lastError: NuiErrorInfo | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = await this.handle(error as Error, { attempt }, 'retry');

        if (!lastError) throw error; // Handled by interceptor

        const shouldContinue =
          attempt < maxRetries &&
          (shouldRetry
            ? shouldRetry(lastError)
            : (retryOnTimeout && lastError.category === NuiErrorCategory.TIMEOUT) ||
              (retryOnNetworkError && lastError.category === NuiErrorCategory.NETWORK));

        if (!shouldContinue) break;

        // Exponential backoff with jitter
        const delay = Math.min(
          maxDelay,
          baseDelay * Math.pow(backoffFactor, attempt) + Math.random() * jitter
        );

        await new Promise(resolve => setTimeout(resolve, delay));
        attempt++;
      }
    }

    throw lastError?.error;
  }
}

/**
 * Global error handler singleton instance
 */
export const globalErrorHandler = new NuiErrorHandler();

/**
 * Retry decorator for async functions
 */
export function withRetry<T extends (...args: any[]) => any>(
  fn: T,
  options: RetryOptions = {}
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return globalErrorHandler.retry(() => fn(...args), options);
  };
}

/**
 * Create error handler for specific use case
 */
export function createErrorHandler(options?: {
  maxHistory?: number;
  interceptors?: ErrorInterceptor[];
}): NuiErrorHandler {
  const handler = new NuiErrorHandler();

  if (options?.maxHistory) {
    (handler as any)['maxHistorySize'] = options.maxHistory;
  }

  if (options?.interceptors) {
    options.interceptors.forEach(interceptor => handler.addInterceptor(interceptor));
  }

  return handler;
}