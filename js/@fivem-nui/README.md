# @fivem-nui/core

> Strongly typed TypeScript bridge between FiveM NUI panel and C#/.NET client script.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/rian-be/FiveM.Nui/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12.0-brightgreen.svg)](#requirements)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue.svg)](#requirements)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](#requirements)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

`@fivem-nui/core` is the TypeScript half of [FiveM.Nui](../../README.md): typed request/response, C#-callable callbacks, events, and window notifications — with no framework and no runtime dependencies. Use it with Svelte, React, Vue, or plain TypeScript.

## Highlights

- **Typed request/response** — correlation IDs, deadlines, and cancellation.
- **Callbacks** — handlers C# can invoke, with clean unregistration.
- **Events** — one-way C# → UI subscriptions, isolated per handler.
- **Window notifications** - `open` / `close` / `focus` / `unfocus`.
- **Error codes, not text** – branch on `NuiRequestError.code`.
- **Diagnostics** – message counters for a dev panel.
- **Zero runtime dependencies**, no framework lock-in.

## Requirements

- Node.js `>= 22.12.0`
- TypeScript `7.x` (the package ships ESM output and `.d.ts` declarations)

## Installation

> **Pre-release:** `@fivem-nui/core` is not published to npm yet. Build it from this repository.

```bash
cd js/@fivem-nui
npm install
npm run build        # emits dist/
```

Point your panel at it:

```jsonc
{
  "dependencies": {
    "@fivem-nui/core": "file:../../js/@fivem-nui"
  }
}
```

Once published, this becomes: `npm install @fivem-nui/core`.

## Quick start

```ts
import { nui } from '@fivem-nui/core';

// Once, on page start. Idempotent.
nui.listen();

// C# -> UI: handle a request and answer it.
nui.callback<void, GetPlayerDataResponse>('player:get', async () => ({
  success: true,
  value: { name: 'NuiPlayer', health: 100 },
}));

// C# -> UI: react to an event. Keep the unsubscribe for teardown.
const unsubscribe = nui.on<InventoryUpdated>('inventory:update', render);

// UI -> C#: fire and forget.
nui.notify('demo:action', { action: 'send' });

// UI -> C#: call a callback registered in C# and await the response.
const result = await nui.request<UseItemRequest, UseItemResponse>('inventory:use', { itemId });
```

`GetPlayerDataResponse`, `InventoryUpdated`, `UseItemRequest`, and `UseItemResponse` are application defined types. The C# side must expose the matching callbacks and handlers.

## API

| Method                                           | Direction | Purpose                                                                                                               |
|--------------------------------------------------|-----------|-----------------------------------------------------------------------------------------------------------------------|
| `listen(target?)`                                | —         | Start receiving messages from C#. Idempotent; returns a function that stops listening.                                |
| `on<T>(event, handler)`                          | C# → UI   | Subscribe to an event. Returns `unsubscribe`.                                                                         |
| `once<T>(event, handler)`                        | C# → UI   | Subscribe to the next matching event only. Returns `unsubscribe`.                                                     |
| `off(event, handler?)`                           | C# → UI   | Remove one handler, or all handlers for the event.                                                                    |
| `callback<TReq, TRes>(event, handler)`           | C# → UI   | Handle C# request the handler returns a `NuiResult`. A thrown handler is answered with `CALLBACK_ERROR`.              |
| `unregisterCallback(event)`                      | C# → UI   | Remove handler, so C# gets `UNKNOWN_CALLBACK` again. Returns `boolean`.                                               |
| `request<TReq, TRes>(event, payload?, timeout?, signal?)` | UI → C#   | Send request and await the response; rejects with `TIMEOUT` after `timeout` (default `30000` ms), or `ABORTED` when `signal` aborts. |
| `send(event, payload?)`                          | UI → C#   | Fire and forget the HTTP reply is not read.                                                                           |
| `sendAndWait(event, payload?)`                   | UI → C#   | Resolve once the POST lands, reject on `POST_TIMEOUT`/`TRANSPORT`. Delivery confirmation only not C# acknowledgement. |
| `notify(callback, payload?)`                     | UI → C#   | POST to a named resource callback; fire and forget.                                                                   |
| `notifyAndWait(callback, payload?)`              | UI → C#   | Same, but resolve once the resource answers.                                                                          |
| `onWindow(handler)`                              | C# → UI   | Receive `(action, window)` for `open` / `close` / `focus` / `unfocus`.                                                |
| `getDiagnostics()`                               | —         | Counter snapshot (`sent`, `received`, `pending`, `listeners`, …).                                                     |
| `dispose()`                                      | —         | Drop listeners, callbacks and pending requests; reject the latter with `DISPOSED`.                                    |

## Errors

Failed operations reject with a `NuiRequestError`. Read `error.code`; `error.message` is for logs and may change. `isNuiRequestError(error)` narrows it inside `catch`.

| Code               | Meaning                                                                           |
|--------------------|-----------------------------------------------------------------------------------|
| `UNKNOWN_CALLBACK` | No handler is registered for the event on the side that had to answer.            |
| `CALLBACK_ERROR`   | A callback handler threw.                                                         |
| `TIMEOUT`          | `request()` exceeded its deadline.                                                |
| `ABORTED`          | The caller aborted the request through its `AbortSignal`.                          |
| `POST_TIMEOUT`     | A single POST was aborted after `postTimeoutMs`.                                  |
| `TRANSPORT`        | The POST failed for another reason (for example, the resource stopped answering). |
| `DISPOSED`         | `dispose()` was called while the operation was attempted or pending.              |
| `UNKNOWN_ERROR`    | A failure was reported without a code.                                            |

```ts
import { nui, NuiErrorCodes, isNuiRequestError } from '@fivem-nui/core';

try {
  await nui.request('inventory:use', { itemId });
} catch (error) {
  if (!isNuiRequestError(error)) throw error;

  if (error.code === NuiErrorCodes.Timeout) {
    showToast('The server did not respond');
  } else {
    showToast('The request could not be completed');
  }
}
```

A `TIMEOUT` rejects the promise but does **not** cancel or roll back the operation: the POST may already have reached C#, and late response is dropped. If the operation has side effects, handle retries and duplicates in your application.

Pass an `AbortSignal` as the fourth argument to `request()` to stop waiting for one request without disposing the client. It rejects with `ABORTED`, and a response that arrives later is dropped.

## Configuration

```ts
new NuiClient({
  resource: 'panel_orders',   // default: GetParentResourceName(), else 'unknown_resource'
  callback: 'nui',            // resource callback endpoint (default: 'nui')
  window: 'panel_orders',     // filter for onWindow (default: every window)
  postTimeoutMs: 10_000,      // per POST abort deadline (default: 10000)
  requestTimeoutMs: 30_000,   // default request() deadline (default: 30000)
  logger: nullNuiLogger,      // consoleNuiLogger (default) or your own NuiLogger
  fetch: myFetch,             // injection seam; default: globalThis.fetch
});
```

The default export `nui` is bound to the ambient resource. Create an instance when you need different options or your own lifecycle.

## Design notes

- **`notify` never awaits its reply.** The browser reads nothing from the HTTP response, so awaiting would only stall the page for the whole POST timeout. Use `notifyAndWait` when delivery matters.
- **`notifyAndWait` exists for the `ready` handshake.** A silent failure there leaves the panel dead for the rest of the session.
- **`request` is for C# callbacks.** If the UI owns the handler for an event, ask C# with `request`, not `notify` — `notify` discards the reply.
- **Dispose on teardown.** Call `dispose()` when the page unmounts (remount, HMR) so a stale client cannot keep answering C# on behalf of dead page. After `dispose()` the client is inert — create a new instance to continue.
- **Handlers are isolated.** A throwing event handler is logged and skipped; its siblings still receive the event. A throwing `callback` handler is answered with `CALLBACK_ERROR` rather than leaving C# waiting.

## Architecture

`NuiClient` is a thin facade over four collaborators, mirroring the C# side of the bridge:

| File                    | Class                                    | Responsibility                                                               |
|-------------------------|------------------------------------------|------------------------------------------------------------------------------|
| `MessageTransport.ts`   | `MessageTransport`                       | POSTs to `https://<resource>/<callback>` with an `AbortController` deadline. |
| `RequestCoordinator.ts` | `RequestCoordinator`                     | In flight requests, correlation IDs, deadlines, settlement.                  |
| `CallbackRegistry.ts`   | `CallbackRegistry`                       | C# request handler lookup.                                                   |
| `EventBus.ts`           | `EventBus`                               | C# → UI subscription and dispatch, with error isolation.                     |
| `NuiClientOptions.ts`   | `NuiClientOptions`, `readResourceName()` | Configuration and resource-name detection.                                   |
| `NuiClient.ts`          | `NuiClient`                              | Orchestration: message dispatch, counters, lifecycle.                        |

## Development

```bash
npm install
npm run build      # tsc -> dist/
npm run check      # tsc --noEmit
npm test           # vitest run
npm run coverage   # vitest run --coverage
npm run watch      # rebuild on change
```

## Contributing

Issues and pull requests are welcome at [github.com/rian-be/FiveM.Nui](https://github.com/rian-be/FiveM.Nui). Keep changes focused, add or update tests for new behavior, and update the docs when a public API or its behavior changes.

## License

[MIT](../../LICENSE) © 2026 Rian.be
