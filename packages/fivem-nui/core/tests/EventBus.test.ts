import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/EventBus';
import { nullNuiLogger } from '../src/logger';

describe('EventBus disposer lifetime', () => {
  it('does not remove a newer listener set through a stale disposer', () => {
    const bus = new EventBus(nullNuiLogger);
    const old = bus.on('x', vi.fn());
    bus.off('x');
    const current = vi.fn();
    bus.on('x', current);

    old();
    bus.emit('x', 42);

    expect(current).toHaveBeenCalledWith(42);
    expect(bus.listenerCount).toBe(1);
  });
});
