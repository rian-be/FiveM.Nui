import { isBrowser, getResourceName } from '@fivem-nui/svelte';

/**
 * Posts a JSON message to an in-game FiveM NUI callback endpoint.
 * No-op when running in standalone browser preview.
 */
export async function postNui(route: string, body: Record<string, unknown> = {}): Promise<void> {
  if (isBrowser()) return;
  try {
    await fetch(`https://${getResourceName('fivem-nui-devtools')}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error(`[DevTools] postNui('${route}') failed:`, err);
  }
}
