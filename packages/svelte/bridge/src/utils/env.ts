/**
 * Detects whether the current page is running inside FiveM's Chromium Embedded Framework (CEF).
 * In FiveM CEF, `window.GetParentResourceName` is injected as a native global function.
 *
 * @returns `true` if executing within FiveM CEF, `false` otherwise.
 */
export function isNui(): boolean {
  return typeof (globalThis as { GetParentResourceName?: unknown }).GetParentResourceName === 'function';
}

/**
 * Returns true when running in a standard browser (Vite dev server, standalone preview), outside FiveM.
 *
 * @returns `true` if running in a standard browser outside FiveM, `false` if inside CEF.
 */
export function isBrowser(): boolean {
  return !isNui();
}

/**
 * Safely resolves the parent resource name if running in FiveM CEF, or returns fallback in browser.
 *
 * @param fallback - Resource name to return if not running in FiveM CEF or if resolution fails.
 * @returns The FiveM resource name or the provided fallback.
 */
export function getResourceName(fallback = 'unknown_resource'): string {
  const g = globalThis as { GetParentResourceName?: () => string };
  if (typeof g.GetParentResourceName === 'function') {
    try {
      return g.GetParentResourceName();
    } catch {
      return fallback;
    }
  }
  return fallback;
}
