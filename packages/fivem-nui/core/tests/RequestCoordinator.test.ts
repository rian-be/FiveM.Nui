import { describe, expect, it, vi } from 'vitest';
import { RequestCoordinator } from '../src/RequestCoordinator';

describe('RequestCoordinator', () => {
  describe('register / resolve / reject', () => {
    it('resolve() deletes the entry before calling the callback', () => {
      const rc = new RequestCoordinator();
      let observed = -1;

      rc.register('a', () => {
        observed = rc.pendingCount;
      }, vi.fn(), setTimeout(() => {}, 100_000));

      expect(rc.resolve('a', 'payload')).toBe(true);

      // Entry must be gone by the time the callback runs.
      expect(observed).toBe(0);
      expect(rc.pendingCount).toBe(0);
    });

    it('reject() deletes the entry before calling the callback', () => {
      const rc = new RequestCoordinator();
      let observed = -1;

      rc.register('a', vi.fn(), () => {
        observed = rc.pendingCount;
      }, setTimeout(() => {}, 100_000));

      expect(rc.reject('a', new Error('bye'))).toBe(true);

      expect(observed).toBe(0);
      expect(rc.pendingCount).toBe(0);
    });

    it('resolve() returns false for unknown id', () => {
      const rc = new RequestCoordinator();
      expect(rc.resolve('ghost', 'x')).toBe(false);
    });

    it('reject() returns false for unknown id', () => {
      const rc = new RequestCoordinator();
      expect(rc.reject('ghost', new Error('x'))).toBe(false);
    });

    it('unregister() removes without resolving or rejecting', () => {
      const rc = new RequestCoordinator();
      const resolve = vi.fn();
      const reject = vi.fn();

      rc.register('a', resolve, reject, setTimeout(() => {}, 100_000));
      rc.unregister('a');

      expect(resolve).not.toHaveBeenCalled();
      expect(reject).not.toHaveBeenCalled();
      expect(rc.pendingCount).toBe(0);
    });
  });

  describe('rejectAll', () => {
    it('rejects all pending and returns the count', () => {
      const rc = new RequestCoordinator();
      const reject1 = vi.fn();
      const reject2 = vi.fn();

      rc.register('a', vi.fn(), reject1, setTimeout(() => {}, 100_000));
      rc.register('b', vi.fn(), reject2, setTimeout(() => {}, 100_000));

      const error = new Error('disposed');
      const count = rc.rejectAll(error);

      expect(count).toBe(2);
      expect(rc.pendingCount).toBe(0);
      expect(reject1).toHaveBeenCalledWith(error);
      expect(reject2).toHaveBeenCalledWith(error);
    });

    it('rejects zero when nothing is pending', () => {
      const rc = new RequestCoordinator();
      expect(rc.rejectAll(new Error('noop'))).toBe(0);
    });

    it('map is empty when each reject callback fires (snapshot-then-clear)', () => {
      const rc = new RequestCoordinator();
      const observedCounts: number[] = [];

      rc.register('a', vi.fn(), () => {
        observedCounts.push(rc.pendingCount);
      }, setTimeout(() => {}, 100_000));
      rc.register('b', vi.fn(), () => {
        observedCounts.push(rc.pendingCount);
      }, setTimeout(() => {}, 100_000));

      rc.rejectAll(new Error('disposed'));

      // The map is cleared before any callback fires, so every callback
      // observes an empty map.
      expect(observedCounts).toEqual([0, 0]);
      expect(rc.pendingCount).toBe(0);
    });

    it('does not wipe entries registered by a reject callback', () => {
      const rc = new RequestCoordinator();

      rc.register(
        'a',
        vi.fn(),
        () => {
          rc.register('late', vi.fn(), vi.fn(), setTimeout(() => {}, 100_000));
        },
        setTimeout(() => {}, 100_000),
      );
      rc.register('b', vi.fn(), vi.fn(), setTimeout(() => {}, 100_000));

      const count = rc.rejectAll(new Error('disposed'));

      expect(count).toBe(2); // only 'a' and 'b', not 'late'
      expect(rc.pendingCount).toBe(1); // 'late' survives
    });
  });

  describe('generateCorrelationId', () => {
    it('produces unique ids', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(RequestCoordinator.generateCorrelationId());
      }
      expect(ids.size).toBe(1000);
    });
  });
});
