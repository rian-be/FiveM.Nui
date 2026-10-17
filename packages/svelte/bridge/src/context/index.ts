import { getContext, setContext, hasContext } from 'svelte';
import type { SvelteNuiClient } from '../client';

/**
 * Global Symbol key used for Svelte Context API registration.
 * Scoped with package prefix to prevent realm collisions with other libraries.
 */
export const NUI_CONTEXT_KEY = Symbol.for('@fivem-nui/svelte:client');

/**
 * Global Symbol key used to store the default client singleton on `globalThis`.
 * Ensures duplicate package copies (e.g. nested node_modules or micro-frontends)
 * share the same default client instance.
 */
const GLOBAL_DEFAULT_KEY = Symbol.for('@fivem-nui/svelte:default-client');

function getDefaultClient(): SvelteNuiClient | null {
  const g = globalThis as unknown as { [GLOBAL_DEFAULT_KEY]?: SvelteNuiClient | null };
  return g[GLOBAL_DEFAULT_KEY] ?? null;
}

function setDefaultClient(client: SvelteNuiClient | null): void {
  const g = globalThis as unknown as { [GLOBAL_DEFAULT_KEY]?: SvelteNuiClient | null };
  g[GLOBAL_DEFAULT_KEY] = client;
}

/**
 * Registers the global default `SvelteNuiClient` instance used when no scoped context is found.
 *
 * @remarks
 * **SSR & CEF Environment**:
 * The default client is a singleton stored on `globalThis` intended for client-side FiveM CEF
 * and SPA environments. In server-side rendering (SSR) environments, avoid relying on global
 * singletons and prefer component-scoped context via `setNuiClient()`.
 *
 * @param client - The client instance to register as the default.
 * @returns The registered client instance for convenient chaining.
 */
export function setDefaultNuiClient(client: SvelteNuiClient): SvelteNuiClient {
  const current = getDefaultClient();
  const isHmr = typeof import.meta !== 'undefined' && Boolean((import.meta as any)?.hot);

  if (!isHmr && current !== null && current !== client) {
    console.warn(
      '[fivem-nui-svelte] setDefaultNuiClient called with a new client instance while a default client was already registered. Overwriting default client.'
    );
  }
  setDefaultClient(client);
  return client;
}

/**
 * Directly retrieves the global default `SvelteNuiClient` instance without checking Svelte context.
 * Useful in standalone stores, utility files, or outside component initialization.
 *
 * @returns The registered global default client, or `null` if none has been registered.
 */
export function getDefaultNuiClient(): SvelteNuiClient | null {
  return getDefaultClient();
}

/**
 * Resets the default global client instance to null.
 * Intended for test isolation and teardown.
 */
export function resetDefaultNuiClient(): void {
  setDefaultClient(null);
}

/**
 * Provides a `SvelteNuiClient` instance to the component hierarchy via Svelte's Context API.
 *
 * @param client - The client instance to provide to child components.
 * @returns The provided client instance for convenient inline assignment.
 *
 * @example
 * ```svelte
 * <script>
 *   import { setNuiClient, SvelteNuiClient } from '@fivem-nui/svelte';
 *   const client = setNuiClient(new SvelteNuiClient());
 * </script>
 * ```
 */
export function setNuiClient(client: SvelteNuiClient): SvelteNuiClient {
  setContext(NUI_CONTEXT_KEY, client);
  return client;
}

/**
 * Retrieves the currently active `SvelteNuiClient`.
 *
 * Resolution priority order:
 * 1. **Component Context**: Scoped client provided via `setNuiClient()` in an ancestor component
 *    (checked safely; outside component lifecycle, this step is skipped).
 * 2. **Explicit Override**: `fallbackClient` argument passed directly to `useNuiClient(fallbackClient)`.
 * 3. **Global Default**: Singleton client registered via `setDefaultNuiClient()` or the default `nui` instance
 *    registered upon importing the root package entrypoint (`src/index.ts`).
 *
 * @remarks
 * **Lifecycle Safety**:
 * Svelte's `hasContext()` / `getContext()` throw a `lifecycle_outside_component` runtime error
 * when invoked outside component initialization (e.g. in async handlers, stores, or outside component trees).
 * This function safely catches that error to allow graceful fallback to the explicit or global client.
 *
 * @param fallbackClient - Optional client to use if no scoped context is found.
 * @returns The resolved `SvelteNuiClient`.
 * @throws Error if no client is found in context, fallback, or default singleton.
 */
export function useNuiClient(fallbackClient?: SvelteNuiClient): SvelteNuiClient {
  try {
    if (hasContext(NUI_CONTEXT_KEY)) {
      return getContext<SvelteNuiClient>(NUI_CONTEXT_KEY);
    }
  } catch {
    // Outside component initialization lifecycle (e.g. async handler, store, or external helper).
    // Safely proceed to explicit fallback or global default client.
  }

  const client = fallbackClient ?? getDefaultClient();
  if (!client) {
    throw new Error(
      '[fivem-nui-svelte] No NuiClient available. Call setNuiClient(client) in a parent component, provide an explicit client argument to useNuiClient(fallback), or register a default client via setDefaultNuiClient(client) at startup.'
    );
  }

  return client;
}