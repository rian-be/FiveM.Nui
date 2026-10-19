import { describe, it, expect } from 'vitest';
import { isAbortError, createAbortError } from '../src/abort';

describe('abort utilities', () => {
  describe('isAbortError', () => {
    it('returns true for DOMException with name AbortError', () => {
      const err = new DOMException('Operation aborted', 'AbortError');
      expect(isAbortError(err)).toBe(true);
    });

    it('returns true for Error with name AbortError', () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      expect(isAbortError(err)).toBe(true);
    });

    it('returns true for Error with code ABORTED', () => {
      const err = Object.assign(new Error('aborted'), { code: 'ABORTED' });
      expect(isAbortError(err)).toBe(true);
    });

    it('returns false for generic errors', () => {
      expect(isAbortError(new Error('generic'))).toBe(false);
      expect(isAbortError(new TypeError('type error'))).toBe(false);
    });

    it('returns false for null, undefined, and primitives', () => {
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
      expect(isAbortError('AbortError')).toBe(false);
      expect(isAbortError(123)).toBe(false);
      expect(isAbortError(true)).toBe(false);
    });

    it('handles objects throwing on property access', () => {
      const problematicObj = {
        get name(): never {
          throw new Error('access denied');
        }
      };
      expect(isAbortError(problematicObj)).toBe(false);
    });
  });

  describe('createAbortError', () => {
    it('creates an AbortError with default message', () => {
      const err = createAbortError();
      expect(isAbortError(err)).toBe(true);
      expect(err.name).toBe('AbortError');
      expect(err.message).toBe('The operation was aborted.');
    });

    it('creates an AbortError with custom message', () => {
      const err = createAbortError('Custom abort message');
      expect(isAbortError(err)).toBe(true);
      expect(err.message).toBe('Custom abort message');
    });

    it('falls back to custom Error when DOMException is unavailable', () => {
      const originalDOMException = globalThis.DOMException;
      try {
        // @ts-expect-error simulating environment without DOMException
        delete globalThis.DOMException;
        const err = createAbortError('Fallback abort');
        expect(isAbortError(err)).toBe(true);
        expect(err.name).toBe('AbortError');
        expect((err as { code?: string }).code).toBe('ABORTED');
        expect(err.message).toBe('Fallback abort');
      } finally {
        globalThis.DOMException = originalDOMException;
      }
    });
  });
});
