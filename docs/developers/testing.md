---
description: "How to write isolated unit tests for FiveM NUI frontends without running the game using @fivem-nui/core/testing."
icon: flask
---

# Testing without FiveM (`@fivem-nui/core/testing`)

> **Run lightning-fast unit and component tests against captured in-memory traffic. No FiveM server, no game client, and zero network overhead.**

The `@fivem-nui/core/testing` subpath provides an in-memory mock bridge and test fixtures. It allows Vitest, Jest, or Playwright tests to exercise your real UI code and verify outgoing NUI envelopes, simulate incoming C# messages, and assert on failure handling.

---

## 1. Quick Example

```ts
import { describe, expect, it, afterEach } from 'vitest';
import { createTestNuiClient, type TestNuiClient } from '@fivem-nui/core/testing';

describe('Player Inventory Component', () => {
  let testNui: TestNuiClient;

  afterEach(() => {
    testNui?.dispose();
  });

  it('receives items and handles purchase requests', async () => {
    // 1. Initialize in-memory test client with mock C# responses:
    testNui = createTestNuiClient({
      callbacks: {
        'shop:purchase': async ({ itemId, count }) => ({
          success: true,
          value: { purchased: true, balance: 1500 }
        })
      }
    });

    // 2. Simulate C# pushing an initial event:
    testNui.emit('inventory:sync', {
      items: [{ id: 'bread', count: 2 }]
    });

    // 3. Trigger a client request:
    const response = await testNui.client.request('shop:purchase', {
      itemId: 'water',
      count: 1
    });

    expect(response).toEqual({ purchased: true, balance: 1500 });

    // 4. Assert on recorded outgoing traffic:
    const sent = testNui.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0].body.event).toBe('shop:purchase');
    expect(sent[0].body.payload).toEqual({ itemId: 'water', count: 1 });
  });
});
```

---

## 2. Initializing `createTestNuiClient`

The `createTestNuiClient` factory function (aliased as `makeClient`) creates an isolated `NuiClient` whose HTTP transport is redirected to in-memory queues:

```ts
import { createTestNuiClient, nullNuiLogger } from '@fivem-nui/core/testing';

const testNui = createTestNuiClient({
  resource: 'qb-inventory',      // default: 'test_resource'
  callback: 'nui',               // default: 'nui'
  postTimeoutMs: 2000,           // default: 10000
  logger: nullNuiLogger,         // default: silent logger
  callbacks: {                   // pre-registered C# handler mocks
    'character:get': async ({ id }) => ({
      success: true,
      value: { id, name: 'John Doe' }
    })
  }
});
```

### `TestNuiClient` API

| Member | Type | Description |
| :--- | :--- | :--- |
| `client` | `NuiClient` | The real `NuiClient` instance under test. |
| `transport` | `FakeFetch` | In-memory transport recorder with `hang()` and `release()` controls. |
| `emit(event, payload)` | `(event: string, payload?: unknown) => void` | Simulates C# pushing an event envelope to the UI. |
| `addCallback(event, handler)` | `(event: string, handler: CallbackHandler) => void` | Dynamically registers a mock C# response handler. |
| `getSentMessages()` | `() => SentMessage[]` | Returns all outgoing envelopes posted by the client. |
| `clearSentMessages()` | `() => void` | Clears the recorded message history. |
| `simulateRequest(id, event, payload)` | `(id: string, event: string, payload?: unknown) => Promise<T>` | Simulates a C# -> UI request (`nui.callback`) and awaits the UI's answer. |
| `dispose()` | `() => void` | Releases all active listeners and rejects pending promises. |

---

## 3. Testing Communication Patterns

### Answering Requests with `callbacks`

Pre-register mock responses in options, or add them dynamically via `addCallback`:

```ts
const testNui = createTestNuiClient();

testNui.addCallback('vehicle:tune', async (req) => {
  if (req.modType === 'turbo') {
    return { success: true, value: { installed: true, cost: 5000 } };
  }
  // Returning a business error:
  return {
    success: false,
    error: { code: 'INVALID_MOD', message: 'Unknown modification type' }
  };
});

const result = await testNui.client.request('vehicle:tune', { modType: 'turbo' });
expect(result.installed).toBe(true);
```

### Low-Level Envelope Injection (`handleMessage`)

When testing specific envelope parsing or raw response injection:

```ts
const testNui = createTestNuiClient();

const pending = testNui.client.request('bank:withdraw', { amount: 500 });

// Wait a microtask for the POST to be queued:
await new Promise(resolve => setTimeout(resolve, 0));

const lastPost = testNui.transport.last()?.body;

// Inject raw response directly:
testNui.client.handleMessage({
  id: lastPost!.id,
  type: 'response',
  success: true,
  payload: { balance: 4500 }
});

await expect(pending).resolves.toEqual({ balance: 4500 });
```

---

## 4. Testing Network Failures & Timeouts

The client distinguishes three distinct failure modes so tests can verify specific error boundaries:

### 1. Transport POST Failures (`NuiErrorCodes.PostTimeout`)

`transport.hang()` causes simulated HTTP POST requests to never settle. When `postTimeoutMs` expires, the transport aborts the POST and rejects with `POST_TIMEOUT`:

```ts
import { createTestNuiClient } from '@fivem-nui/core/testing';
import { NuiErrorCodes } from '@fivem-nui/core';

it('rejects with POST_TIMEOUT when the resource fails to respond to HTTP POST', async () => {
  const testNui = createTestNuiClient({ postTimeoutMs: 50 });
  testNui.transport.hang();

  // POST never completes within 50ms:
  await expect(testNui.client.notifyAndWait('ready')).rejects.toMatchObject({
    code: NuiErrorCodes.PostTimeout,
  });

  testNui.transport.release();
  testNui.dispose();
});
```

### 2. C# Response Deadline (`NuiErrorCodes.Timeout`)

When the HTTP POST succeeds immediately, but C# never returns a correlation response envelope within the request deadline, the client rejects with `TIMEOUT`:

```ts
it('rejects with TIMEOUT when C# never answers the request', async () => {
  const testNui = createTestNuiClient();

  // Request timeout set to 50ms (default is 30,000ms):
  const request = testNui.client.request('character:get', { id: 1 }, 50);

  await expect(request).rejects.toMatchObject({
    code: NuiErrorCodes.Timeout,
  });

  testNui.dispose();
});
```

### 3. Request Cancellation (`NuiErrorCodes.Aborted`)

When the caller passes an `AbortSignal` and triggers cancellation (e.g. user closes panel or switches tabs):

```ts
it('rejects with ABORTED when AbortSignal is cancelled', async () => {
  const testNui = createTestNuiClient();
  testNui.transport.hang();

  const controller = new AbortController();
  controller.abort(); // Cancelled before or during execution

  const request = testNui.client.request('character:get', {}, 5000, controller.signal);

  await expect(request).rejects.toMatchObject({
    code: NuiErrorCodes.Aborted,
  });

  testNui.transport.release();
  testNui.dispose();
});
```

---

## 5. Standalone `fakeFetch`

If you are testing custom transport wrappers without needing a full `NuiClient`:

```ts
import { fakeFetch } from '@fivem-nui/core/testing';
import { NuiClient } from '@fivem-nui/core';

const transport = fakeFetch();
const client = new NuiClient({
  resource: 'custom_resource',
  fetch: transport.impl
});

client.send('custom:event', { data: 123 });

expect(transport.posts).toHaveLength(1);
expect(transport.last()?.url).toBe('https://custom_resource/nui');
```
