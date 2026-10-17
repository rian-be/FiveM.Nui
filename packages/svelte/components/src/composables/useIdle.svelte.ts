/**
 * Hooks tracking user inactivity and idle state in FiveM NUI.
 * Note: Must be called within a component lifecycle context due to `$effect`.
 */

export interface IdleState {
  readonly isIdle: boolean;
  readonly idleTime: number;
  reset(force?: boolean): void;
}

const IDLE_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'scroll',
  'wheel',
] as const;

const THROTTLE_MS = 500;

/**
 * Shared core helper managing event listeners with capture mode, throttle bypass, and timeout scheduling.
 */
function createIdleManager(
  timeoutMs: number,
  onTimeout: () => void,
  onActivity?: () => void,
  shouldBypassThrottle?: () => boolean,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let lastResetTime = 0;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function schedule() {
    clearTimer();
    timer = setTimeout(onTimeout, timeoutMs);
  }

  function handleActivity(force = false) {
    const now = Date.now();
    const bypass = force || (shouldBypassThrottle?.() ?? false);
    if (!bypass && now - lastResetTime < THROTTLE_MS) return;
    lastResetTime = now;

    onActivity?.();
    schedule();
  }

  const listener = () => handleActivity(false);

  function init() {
    controller = new AbortController();
    for (const event of IDLE_EVENTS) {
      window.addEventListener(event, listener, {
        passive: true,
        capture: true, // Crucial for catching scrolls inside inner NUI containers
        signal: controller.signal,
      });
    }

    schedule();

    return () => {
      clearTimer();
      controller?.abort();
      controller = null;
    };
  }

  return {
    init,
    reset: (force = true) => handleActivity(force), // Manual reset defaults to forcing bypass
  };
}

/**
 * Tracks user inactivity and idle state in NUI.
 */
export function useIdle(
  timeoutMs = 30_000,
  updateIntervalMs = 1_000,
): IdleState {
  let isIdle = $state(false);
  let idleTime = $state(0);

  let lastActive = Date.now();
  let interval: ReturnType<typeof setInterval> | null = null;

  function updateIdleTime() {
    idleTime = Math.max(0, Date.now() - lastActive);
  }

  function startInterval() {
    if (interval) return;
    interval = setInterval(updateIdleTime, updateIntervalMs);
  }

  function stopInterval() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  const manager = createIdleManager(
    timeoutMs,
    () => {
      isIdle = true;
      // Synchronize idleTime immediately when entering idle state
      idleTime = Math.max(0, Date.now() - lastActive);
    },
    () => {
      lastActive = Date.now();
      idleTime = 0;
      if (isIdle) {
        isIdle = false;
      }
      startInterval();
    },
    () => isIdle, // Instantly bypass throttle when user is currently idle (waking up)
  );

  $effect(() => {
    lastActive = Date.now();
    idleTime = 0;
    isIdle = false;
    startInterval();
    const cleanupManager = manager.init();

    return () => {
      cleanupManager();
      stopInterval();
    };
  });

  return {
    get isIdle() {
      return isIdle;
    },
    get idleTime() {
      return idleTime;
    },
    reset: (force = true) => manager.reset(force),
  };
}

/**
 * One-shot activity observer: executes callback exactly once when the user becomes idle.
 * Returns a cancel function to abort observation.
 */
export function useIdleUntil(
  timeoutMs = 30_000,
  callback?: () => void,
): () => void {
  let fired = false;
  let cleanupManager: (() => void) | null = null;

  const manager = createIdleManager(timeoutMs, () => {
    if (!fired) {
      fired = true;
      callback?.();
      cleanupManager?.();
      cleanupManager = null;
    }
  });

  $effect(() => {
    fired = false; // Reset fired state on effect re-run/re-mount
    cleanupManager = manager.init();

    return () => {
      cleanupManager?.();
      cleanupManager = null;
    };
  });

  const cancel = () => {
    cleanupManager?.();
    cleanupManager = null;
  };

  return cancel;
}