/**
 * Test utilities for @fivem-nui/core.
 *
 * Build a fake NUI bridge without running FiveM, so UI and component tests can
 * exercise the real client against captured traffic.
 *
 * @example
 * ```ts
 * import { createTestNuiClient } from '@fivem-nui/core/testing';
 *
 * const testNui = createTestNuiClient({
 *   callbacks: {
 *     'character:get': async ({ characterId }) => ({
 *       success: true,
 *       value: { id: characterId, name: 'John Doe', cash: 500 },
 *     }),
 *   },
 * });
 *
 * // Simulate C# sending events to the frontend
 * testNui.emit('inventory:updated', {
 *   items: [{ id: 'water', count: 3 }],
 * });
 *
 * // Make requests and check outgoing traffic
 * const result = await testNui.client.request('character:get', { characterId: 1 });
 * console.log(testNui.getSentMessages());
 *
 * // Clean up between tests
 * testNui.dispose();
 * ```
 *
 * See `docs/testing.md` for usage examples.
 */
export { createTestNuiClient, createTestNuiClient as makeClient } from './make-client';
export type { TestClientOptions, TestNuiClient, SentMessage, CallbackHandler, CallbackMap } from './make-client';
export { fakeFetch } from './fake-fetch';
export type { CapturedPost, FakeFetch } from './fake-fetch';