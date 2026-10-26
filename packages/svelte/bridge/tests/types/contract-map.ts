import type { SvelteNuiClient } from '../../src/client';

declare module '@fivem-nui/core' {
  interface NuiEventMap {
    'inventory:use': { request: { itemId: string }; response: { ok: boolean } };
    'player:health': { payload: { health: number } };
  }
}

declare const client: SvelteNuiClient;

client.on('player:health', data => void data.health);
client.send('player:health', { health: 10 });
void client.request('inventory:use', { itemId: 'water' });

// @ts-expect-error unknown names are rejected once NuiEventMap is augmented
client.send('unknown:event', {});
// @ts-expect-error request payload must match the mapped request
void client.request('inventory:use', { wrong: true });
