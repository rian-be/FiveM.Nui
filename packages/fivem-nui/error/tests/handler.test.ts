import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NuiErrorHandler, withRetry, createErrorHandler } from '../src/handler';
import { NuiErrorCategory, NuiErrorSeverity } from '../src/types';
import { createAbortError } from '../src/abort';

describe('NuiErrorHandler', () => {
  let handler: NuiErrorHandler;

  beforeEach(() => {
    handler = new NuiErrorHandler();
  });

  describe('categorizeError', () => {
    it('categorizes network errors by message', () => {
      expect(handler.categorizeError(new Error('Failed to fetch resource'))).toBe(NuiErrorCategory.NETWORK);
      expect(handler.categorizeError(new Error('ECONNREFUSED'))).toBe(NuiErrorCategory.NETWORK);
      expect(handler.categorizeError(new Error('network disconnect'))).toBe(NuiErrorCategory.NETWORK);
    });

    it('categorizes network errors by code or name', () => {
      const errWithCode = Object.assign(new Error('fail'), { code: 'NETWORK' });
      expect(handler.categorizeError(errWithCode)).toBe(NuiErrorCategory.NETWORK);

      const errWithTransport = Object.assign(new Error('fail'), { code: 'TRANSPORT' });
      expect(handler.categorizeError(errWithTransport)).toBe(NuiErrorCategory.NETWORK);

      const errWithName = Object.assign(new Error('fail'), { name: 'NetworkError' });
      expect(handler.categorizeError(errWithName)).toBe(NuiErrorCategory.NETWORK);
    });

    it('categorizes timeout errors', () => {
      expect(handler.categorizeError(new Error('request timeout occurred'))).toBe(NuiErrorCategory.TIMEOUT);
      const errWithCode = Object.assign(new Error('fail'), { code: 'TIMEOUT' });
      expect(handler.categorizeError(errWithCode)).toBe(NuiErrorCategory.TIMEOUT);
      const errWithName = Object.assign(new Error('fail'), { name: 'TimeoutError' });
      expect(handler.categorizeError(errWithName)).toBe(NuiErrorCategory.TIMEOUT);
    });

    it('categorizes callback errors', () => {
      expect(handler.categorizeError(new Error('InvokeNative error in callback'))).toBe(NuiErrorCategory.CALLBACK);
      expect(handler.categorizeError(new Error('CALLBACK_NOT_FOUND'))).toBe(NuiErrorCategory.CALLBACK);
    });

    it('categorizes validation errors', () => {
      expect(handler.categorizeError(new Error('validation failed for payload'))).toBe(NuiErrorCategory.VALIDATION);
      const valErr = Object.assign(new Error('fail'), { name: 'ValidationError' });
      expect(handler.categorizeError(valErr)).toBe(NuiErrorCategory.VALIDATION);
      const zodErr = Object.assign(new Error('fail'), { name: 'ZodError' });
      expect(handler.categorizeError(zodErr)).toBe(NuiErrorCategory.VALIDATION);
    });

    it('categorizes script errors', () => {
      expect(handler.categorizeError(new TypeError('cannot read properties'))).toBe(NuiErrorCategory.SCRIPT);
      expect(handler.categorizeError(new ReferenceError('x is not defined'))).toBe(NuiErrorCategory.SCRIPT);
      expect(handler.categorizeError(new SyntaxError('unexpected token'))).toBe(NuiErrorCategory.SCRIPT);
    });

    it('categorizes unknown errors', () => {
      expect(handler.categorizeError(new Error('something strange'))).toBe(NuiErrorCategory.UNKNOWN);
    });
  });

  describe('interceptors and history', () => {
    it('manages interceptors correctly', async () => {
      const interceptor = vi.fn((info) => ({ ...info, context: { intercepted: true } }));
      const unsubscribe = handler.addInterceptor(interceptor);

      const result = await handler.handle(new Error('test error'));
      expect(interceptor).toHaveBeenCalledTimes(1);
      expect(result?.context).toEqual({ intercepted: true });

      unsubscribe();
      await handler.handle(new Error('test error 2'));
      expect(interceptor).toHaveBeenCalledTimes(1);
    });

    it('allows interceptor removal via removeInterceptor', async () => {
      const interceptor = vi.fn((info) => info);
      handler.addInterceptor(interceptor);
      expect(handler.removeInterceptor(interceptor)).toBe(true);
      expect(handler.removeInterceptor(interceptor)).toBe(false);
    });

    it('suppresses error when interceptor returns null', async () => {
      handler.addInterceptor(() => null);
      const result = await handler.handle(new Error('suppressed'));
      expect(result).toBeNull();
    });

    it('tracks history and allows clearing', async () => {
      await handler.handle('error 1');
      await handler.handle('error 2');
      expect(handler.getErrorHistory().length).toBe(2);

      handler.clearHistory();
      expect(handler.getErrorHistory().length).toBe(0);
    });
  });

  describe('retry with abort support', () => {
    it('resolves on first successful execution', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const res = await handler.retry(fn);
      expect(res).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on timeout error and succeeds', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          throw Object.assign(new Error('timeout error'), { code: 'TIMEOUT' });
        }
        return 'recovered';
      });

      const res = await handler.retry(fn, {
        maxRetries: 2,
        baseDelay: 1,
        jitter: 0
      });

      expect(res).toBe('recovered');
      expect(callCount).toBe(2);
    });

    it('does NOT retry when error is an AbortError', async () => {
      let callCount = 0;
      const abortErr = createAbortError('Request was aborted by user');

      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        throw abortErr;
      });

      await expect(
        handler.retry(fn, {
          maxRetries: 3,
          baseDelay: 1,
          jitter: 0
        })
      ).rejects.toThrow('Request was aborted by user');

      // Crucial: Must stop immediately on AbortError, no retries!
      expect(callCount).toBe(1);
    });

    it('respects custom shouldRetry predicate', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        throw new Error('custom failure');
      });

      await expect(
        handler.retry(fn, {
          maxRetries: 2,
          baseDelay: 1,
          jitter: 0,
          shouldRetry: (info) => info.error.message.includes('custom')
        })
      ).rejects.toThrow('custom failure');

      expect(callCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('helper utilities', () => {
    it('wraps a function with withRetry decorator', async () => {
      const { withRetry } = await import('../src/handler');
      const mockFn = vi.fn().mockResolvedValue('decorated');
      const wrapped = withRetry(mockFn);

      const result = await wrapped();
      expect(result).toBe('decorated');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('creates custom handler with createErrorHandler', () => {
      const interceptor = vi.fn((info) => info);
      const customHandler = createErrorHandler({
        maxHistory: 5,
        interceptors: [interceptor]
      });

      expect(customHandler).toBeInstanceOf(NuiErrorHandler);
    });
  });
});
