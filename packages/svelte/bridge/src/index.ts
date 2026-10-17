// Main entrypoint for @fivem-nui/svelte
// High-performance Svelte SDK for FiveM NUI

import { SvelteNuiClient, type SvelteNuiClientOptions } from './client';
import { setDefaultNuiClient } from './context';

// ===== GLOBAL CLIENT SINGLETON & FACTORY =====

/**
 * Default global `SvelteNuiClient` singleton instance.
 * Automatically registered with {@link setDefaultNuiClient}.
 */
export const nui = new SvelteNuiClient();
setDefaultNuiClient(nui);

/**
 * Creates a new custom `SvelteNuiClient` instance.
 *
 * @param options - Configuration options for the client.
 * @returns A new `SvelteNuiClient` instance.
 */
export function createNui(options?: SvelteNuiClientOptions): SvelteNuiClient {
  return new SvelteNuiClient(options);
}

// ===== CLIENT CLASS & TYPES =====

export { SvelteNuiClient, type SvelteNuiClientOptions };

// ===== DOMAINS RE-EXPORTS =====

export * from './context';
export * from './runes/index.svelte';
export * from './actions';
export * from './utils';
export * from './mock';
export * from '@fivem-nui/error';

// ===== CORE CONTRACTS RE-EXPORTS =====

export type {
  NuiEventMap,
  NuiEventKey,
  NuiEventRequest,
  NuiEventResponse,
  NuiEventPayload,
  SendPayload,
  RequestPayload,
  RequestResponse,
  NuiWindowAction,
  NuiMessage,
  NuiError
} from '@fivem-nui/core';