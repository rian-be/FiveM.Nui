import type { NuiClient } from '@fivem-nui/core';

/**
 * Compile-time check for the generated contract surface. This file is never
 * executed; `tsc` is the assertion. It stands in for the module a
 * `FiveM.Nui.Contracts` run emits, which augments the event map from the C#
 * `[NuiEvent]` contracts. The specifier below is exactly what the generator
 * writes by default.
 */
declare module '@fivem-nui/core' {
  interface NuiEventMap {
    'inventory:use': { request: UseItemRequest; response: UseItemResponse };
    'player:healthChanged': { payload: HealthChanged };
  }
}

export interface UseItemRequest {
  itemId: string;
}

export interface UseItemResponse {
  ok: boolean;
}

export interface HealthChanged {
  health: number;
}

declare const nui: NuiClient;

async function requestIsTyped(): Promise<boolean> {
  const response = await nui.request('inventory:use', { itemId: 'x' });

  return response.ok;
}

function eventsAreTyped(): void {
  const unsubscribe = nui.on('player:healthChanged', data => {
    const health: number = data.health;
    void health;
  });

  unsubscribe();
}

function unknownEventIsRejected(): void {
  // @ts-expect-error - a name absent from NuiEventMap must not compile
  void nui.send('inventory:usee', { itemId: 'x' });
}

async function wrongRequestIsRejected(): Promise<void> {
  // @ts-expect-error - the request payload must match the contract
  await nui.request('inventory:use', { wrong: true });
}

export { requestIsTyped, eventsAreTyped, unknownEventIsRejected, wrongRequestIsRejected };
