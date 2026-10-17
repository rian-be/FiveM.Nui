/**
 * Media query hooks for FiveM NUI.
 */

export interface MediaQueryState {
  readonly matches: boolean;
}

export type MediaQuerySource = string | (() => string);

/**
 * Media query listener.
 * 
 * Supports both static query strings and reactive getters (`() => string`).
 * Automatically manages event listener lifecycle via `$effect`.
 * 
 * Note: Must be called within a component initialization context (or wrapped in `$effect.root`).
 */
export function useMediaQuery(querySource: MediaQuerySource): MediaQueryState {
  const resolveQuery = () => (typeof querySource === 'function' ? querySource() : querySource);

  let matches = $state<boolean>(
    typeof window !== 'undefined' ? window.matchMedia(resolveQuery()).matches : false
  );

  $effect(() => {
    const query = resolveQuery();
    const mediaQuery = window.matchMedia(query);

    // Sync matches state in case the query changed
    matches = mediaQuery.matches;

    const handler = (event: MediaQueryListEvent) => {
      matches = event.matches;
    };

    mediaQuery.addEventListener('change', handler);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  });

  return {
    get matches() {
      return matches;
    }
  };
}

/**
 * Tracks whether the viewport width is strictly less than the specified breakpoint.
 * Uses modern CSS range syntax (fully supported in modern Chromium/FiveM CEF).
 * Accepts any valid CSS length unit (e.g. '768px', '48rem').
 * @default breakpoint '768px'
 */
export function useIsMobile(breakpoint = '768px'): MediaQueryState {
  return useMediaQuery(`(width < ${breakpoint})`);
}

/**
 * Tracks whether the viewport width falls within the tablet range using modern CSS range syntax.
 * Accepts any valid CSS length units.
 * @default min '768px', max '1024px'
 */
export function useIsTablet(min = '768px', max = '1024px'): MediaQueryState {
  return useMediaQuery(`(${min} <= width < ${max})`);
}

/**
 * Tracks whether the viewport width is greater than or equal to the specified breakpoint.
 * Accepts any valid CSS length units.
 * @default breakpoint '1024px'
 */
export function useIsDesktop(breakpoint = '1024px'): MediaQueryState {
  return useMediaQuery(`(width >= ${breakpoint})`);
}

/**
 * Tracks dark mode preference. 
 * Note: In embedded CEF (FiveM NUI), OS-level color scheme detection may not reflect host system settings;
 * consider overriding or syncing this via `useLocalStorage` if your UI supports manual theme switching.
 */
export function useDarkMode(): MediaQueryState {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Tracks reduced motion preference.
 * Note: In embedded CEF (FiveM NUI), OS-level accessibility settings may not propagate from the host system.
 */
export function useReducedMotion(): MediaQueryState {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Tracks high contrast / forced colors mode.
 * Note: In embedded CEF (FiveM NUI), system contrast settings may not propagate from the host system.
 */
export function useHighContrast(): MediaQueryState {
  return useMediaQuery('(forced-colors: active)');
}