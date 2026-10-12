/**
 * Logging seam for the bridge.
 *
 * Everything the client would print goes through here, so tests can capture it
 * and applications can silence or redirect it without patching `console`.
 */
export interface NuiLogger {
  debug(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Serializes a single log argument for environments where the console does not
 * support object inspection (e.g. FiveM NUI's bridged `console`).
 *
 * Strings are passed through verbatim; objects and other values are JSON-stringified
 * (falling back to `String()` on circular structure or serialization failure).
 */
function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/**
 * Default logger; writes to the browser console with a `[NUI]` prefix.
 *
 * In FiveM NUI, the browser `console` is bridged to the game console, which does
 * not support object inspection. Object arguments are therefore JSON-stringified
 * so debug output remains readable instead of printing `[object Object]`.
 */
export const consoleNuiLogger: NuiLogger = {
  debug(message, ...args) {
    console.debug(`[NUI] ${message}`, ...args.map(formatArg));
  },
  warn(message, ...args) {
    console.warn(`[NUI] ${message}`, ...args.map(formatArg));
  },
  error(message, ...args) {
    console.error(`[NUI] ${message}`, ...args.map(formatArg));
  },
};

/** Logger that drops everything; useful for production panels and tests. */
export const nullNuiLogger: NuiLogger = {
  debug() {},
  warn() {},
  error() {},
};
