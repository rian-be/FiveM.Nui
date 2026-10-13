# FiveM.Nui

A strongly typed bridge between C#/.NET FiveM client scripts and NUI frontends.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4.svg)](https://dotnet.microsoft.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue.svg)](js/@fivem-nui)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](js/@fivem-nui)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

FiveM.Nui provides a typed communication layer between FiveM C# client resource and its NUI frontend. Instead of manually handling JSON, registering callbacks, and matching requests to responses, you work with C# records, TypeScript types, events, and callbacks.

The library is designed to fit into your existing resource. Use Svelte, React, Vue, or plain TypeScript for the UI, while keeping game logic in C#.

## Why FiveM.Nui?

Building NUI interface often means maintaining separate communication code on the C# and JavaScript sides. Event names, payload formats, callback registration, and request IDs can quickly become difficult to manage.

FiveM.Nui brings these responsibilities behind a consistent API.

- **Typed communication** — use C# records and DTOs alongside TypeScript request and response types.
- **Request/response messaging** — correlate requests with responses and handle timeouts, deadlines, and cancellation.
- **Callbacks in both directions** — let the UI call C# handlers and let C# request data from the UI.
- **Events** — publish one way messages and subscribe to updates without building your own event infrastructure.
- **Window management** — open, close, focus, and unfocus NUI windows through a consistent API.
- **Input ownership** — track keyboard focus ownership per window.
- **Diagnostics** — inspect message counters, payload sizes, and timings when diagnostics are enabled.
- **Structured errors** — handle failures through error codes instead of matching exception messages.
- **No UI framework dependency** — integrate the bridge with your frontend of choice.
- **No runtime dependencies** — the TypeScript package does not require additional runtime packages.

> [!NOTE]
> FiveM.Nui is not yet published on NuGet or npm. Both packages must currently be built from source and referenced locally.

## How it works

A FiveM.Nui resource has two communicating parts:

```text
┌──────────────────────────┐
│      C# client script    │
│                          │
│  NuiClient / NuiGateway  │
└────────────┬─────────────┘
             │
             │ JSON message envelopes
             │ Requests, responses, events
             │
┌────────────▼─────────────┐
│       NUI frontend       │
│                          │
│      @fivem-nui/core     │
└──────────────────────────┘
```

Both sides use a shared message protocol.

The NUI frontend sends HTTP POST requests to a single FiveM resource callback, named `nui` by default. C# dispatches incoming messages based on their envelope type and event name.

`NuiGateway.Bootstrap()` connects the C# side to the FiveM callback mechanism and registers the `ready` and `close` lifecycle hooks.

Once the bridge is initialized, the resource can exchange messages without manually implementing the transport and request-correlation logic for every feature.

> **Scope:** FiveM.Nui is client side NUI bridge. It does not replace your server side game logic, framework, database, or authorization checks. Keep authoritative game operations on the server and validate client originated requests accordingly.

## Requirements

- **.NET 10 SDK** for the C# library.
- **Node.js 22.12.0 or newer** for the TypeScript package.
- **TypeScript 7.x** for TypeScript development and type-checking.

The C# library targets .NET 10 and is built with C# 14. The TypeScript package provides ESM output and TypeScript declaration files.

## Installation

### C# library

NuGet distribution is planned. Until it is available, reference the project directly:

```xml
<ItemGroup>
  <ProjectReference Include="path/to/FiveM.Nui.csproj" />
</ItemGroup>
```

Once the package is published, installation will use:

```bash
dotnet add package FiveM.Nui
```

### TypeScript bridge

`@fivem-nui/core` is not yet published to npm. Build it from this repository:

```bash
cd js/@fivem-nui
npm install
npm run build
```

The build generates the package output in `dist/`.

Add the local package to your NUI resource's `package.json`:

```json
{
  "dependencies": {
    "@fivem-nui/core": "file:../../js/@fivem-nui"
  }
}
```

Adjust the relative path to match your resource layout, then install the dependency:

```bash
npm install
```

## Quick start

The following example illustrates the main pieces of the bridge: initializing the gateway, registering a callback, subscribing to an event, and opening a window.

### C# client

```csharp
using FiveM.Nui;
using FiveM.Nui.Abstractions;

var nui = new NuiGateway("inventory");

// Register the NUI transport callback and lifecycle hooks.
nui.Bootstrap(onReady: async () =>
{
    // Send initial state after the UI signals that it is ready.
    await nui.SendAsync(
        "inventory:update",
        new InventoryUpdated(items));
});

// Register a callback that the UI can invoke.
nui.RegisterCallback<UseItemRequest, UseItemResponse>(
    "inventory:use",
    (request, cancellationToken) =>
        Task.FromResult(
            NuiResult<UseItemResponse>.Ok(
                new(true, "Item used"))));

// Subscribe to an event sent by the UI.
nui.Subscribe<HealthChanged>(
    "player:healthChanged",
    health => SetHealth(health.Health));

// Open the window and take focus.
await nui.ShowAsync("inventory");
```

`InventoryUpdated`, `UseItemRequest`, `UseItemResponse`, and `HealthChanged` are application-defined contracts. `items` and `SetHealth` represent your resource's own state and logic.

The example assumes the corresponding contracts and application members exist in your resource.

`NuiGateway` extends `NuiClient` with FiveM specific bootstrapping and window helpers. The regular messaging API is available directly on the gateway.

### TypeScript frontend

```ts
import { nui } from '@fivem-nui/core';

// Start receiving messages from C#.
nui.listen();

// Handle a request initiated by C#.
nui.callback<void, GetPlayerDataResponse>(
  'player:get',
  async () => ({
    success: true,
    value: {
      name: 'NuiPlayer',
      health: 100,
    },
  }),
);

// Subscribe to updates from C#.
const unsubscribe = nui.on<InventoryUpdated>(
  'inventory:update',
  render,
);

// Request an operation from a C# callback.
const result = await nui.request<
  UseItemRequest,
  UseItemResponse
>('inventory:use', {
  itemId,
});
```

The types shown above are defined by your application. The TypeScript generic arguments describe the expected payload and response types they do not automatically validate arbitrary runtime JSON.

The default `nui` instance uses the ambient FiveM resource name. Create `NuiClient` instance when you need custom options or an independently managed lifecycle.

## Communication model

FiveM.Nui supports several messaging patterns. Choose the one that matches the interaction you need.

| API | Direction | Purpose |
|---|---|---|
| `SendAsync<T>()` | C# → UI | Send a message to the frontend. |
| `Publish<T>()` | C# → UI | Publish a one-way event. |
| `RequestAsync<TReq, TRes>()` | C# → UI | Send a request and await a response. |
| `RegisterCallback<TReq, TRes>()` | UI → C# | Register a C# handler that the UI can invoke. |
| `Subscribe<T>()` | UI → C# | Handle events raised by the frontend. |
| `OpenAsync()` / `CloseAsync()` | Window | Open or close a window. |
| `FocusAsync()` / `UnfocusAsync()` | Input | Acquire or release focus. |

The TypeScript package provides corresponding APIs for subscriptions, callbacks, requests, and outgoing messages.

### Events

Use events when the sender does not need a direct response.

For example, C# can publish health update and the UI can react to it:

```csharp
nui.Publish(
    "player:healthUpdated",
    new HealthChanged(75));
```

```ts
const unsubscribe = nui.on<HealthChanged>(
  'player:healthUpdated',
  ({ health }) => {
    updateHealthBar(health);
  },
);
```

On the C# side, `Subscribe<T>()` provides the corresponding way to react to events raised by the frontend.

Events travel in both directions, so give each direction its own name: use `player:healthChanged` when the UI notifies C#, and `player:healthUpdated` when C# notifies the UI. Keep event names and payload contracts consistent between both sides.

### Request/response

Use request/response messaging when the caller needs result.

For example, the UI can request that the C# client handle an item use operation:

```ts
const result = await nui.request<
  UseItemRequest,
  UseItemResponse
>('inventory:use', {
  itemId: 'water',
});
```

The C# side registers the handler:

```csharp
nui.RegisterCallback<UseItemRequest, UseItemResponse>(
    "inventory:use",
    HandleUseItem);
```

The bridge correlates the response with the original request. Requests also support timeout handling and cancellation.

A timeout does not guarantee that the underlying operation stopped or failed to execute. If an operation has side effects, design its retry behavior accordingly.

### Callbacks in both directions

The bridge supports handlers on both sides:

- **UI → C#:** register C# callback that the frontend can invoke.
- **C# → UI:** register TypeScript callback that returns result to the C# caller.

This allows the frontend to request data or operations without introducing separate ad hoc messaging mechanism for each interaction.

## C# API

### `NuiClient`

`NuiClient` provides the core communication functionality.

| Method | Description |
|---|---|
| `SendAsync<T>(event, payload, ct)` | Sends a message to the UI. |
| `RequestAsync<TReq, TRes>(event, request, ct)` | Sends a request and awaits its response. |
| `Publish<T>(event, payload)` | Publishes a one-way event. |
| `RegisterCallback<TReq, TRes>(event, handler, options?)` | Registers a callback for requests from the UI. |
| `UnregisterCallback(event)` | Removes a callback and returns a `bool`. |
| `Subscribe<T>(event, handler)` | Subscribes to events raised by the UI; returns `IDisposable`. |
| `GetDiagnostics()` | Returns a diagnostics snapshot. |

The client also provides window and focus operations.

### `NuiGateway`

`NuiGateway` adds FiveM specific integration on top of `NuiClient`.

| Method | Description |
|---|---|
| `Bootstrap(onReady?, onClose?)` | Registers the `nui` callback and lifecycle hooks. |
| `ShowAsync(window, onShown?)` | Opens and focuses a window. |
| `HideAsync(window)` | Releases focus and closes a window. |
| `Run(Func<Task>)` | Provides a low-level helper for running asynchronous work. |
| `RegisterCallback(name, Action<string>)` | Provides low-level callback registration. |

Use `NuiGateway` when you need the FiveM integration helpers. Use `NuiClient` when you need the core messaging API directly.

## Message protocol

Messages are serialized as camelCase JSON envelopes.

### Event

An event is a one way message:

```json
{
  "type": "event",
  "event": "player:healthUpdated",
  "payload": {
    "health": 75
  }
}
```

### Request

A request includes an identifier used to associate the response with the original request:

```json
{
  "id": "e2f6...",
  "type": "request",
  "event": "player:get",
  "payload": {}
}
```

### Successful response

```json
{
  "id": "e2f6...",
  "type": "response",
  "success": true,
  "payload": {
    "name": "Player"
  }
}
```

### Failed response

```json
{
  "id": "e2f6...",
  "type": "response",
  "success": false,
  "error": {
    "code": "CALLBACK_ERROR",
    "message": "..."
  }
}
```

These examples illustrate the protocol's message shapes. The bridge is responsible for routing messages and matching responses; application-specific payloads are defined by your resource.

## Error handling

### C# results

Callbacks use `NuiResult<T>` to represent success or failure without requiring exceptions to cross the messaging boundary.

```csharp
public sealed record NuiResult<T>
{
    public bool Success { get; init; }
    public T? Value { get; init; }
    public NuiError? Error { get; init; }
}
```

The library also provides convenience extensions such as:

- `IsFailure`
- `ValueOrDefault`
- `ValueOrThrow()`
- `FromNullable(...)`

Requests that fail throw `NuiException`, which exposes an `ErrorCode`:

```csharp
try
{
    var response = await nui.RequestAsync<
        GetPlayerDataRequest,
        GetPlayerDataResponse>(
            "player:get",
            new GetPlayerDataRequest());
}
catch (NuiException ex)
{
    Console.WriteLine($"{ex.ErrorCode}: {ex.Message}");
}
```

### TypeScript errors

Failed operations reject with `NuiRequestError`. Use `isNuiRequestError()` to narrow the error type and inspect `error.code`.

The package defines codes including:

| Code | Meaning |
|---|---|
| `UNKNOWN_CALLBACK` | No matching callback is registered. |
| `CALLBACK_ERROR` | A callback failed while processing a request. |
| `TIMEOUT` | A request exceeded its deadline. |
| `POST_TIMEOUT` | A POST operation exceeded its timeout. |
| `TRANSPORT` | A transport-level failure occurred. |
| `DISPOSED` | The client has been disposed. |
| `UNKNOWN_ERROR` | An unexpected error occurred. |

A request timeout rejects the waiting operation but does not, by itself, cancel the underlying work.

## Callback execution and serialization

Inbound callbacks are dispatched concurrently by default.

When callbacks modify shared state and must not execute simultaneously, configure serialization:

```csharp
nui.RegisterCallback<PurchaseRequest, PurchaseResponse>(
    "shop:purchase",
    handler,
    new NuiCallbackOptions
    {
        Serialize = true,
        SerializationGroup = "shop"
    });
```

`Serialize` enables serialized execution for the callback. `SerializationGroup` allows related callbacks to share a serialization gate.

For example, operations such as purchasing, applying, and cancelling changes may need to use the same group when they must not modify shared state concurrently.

## Serialization

The C# side uses `System.Text.Json` with:
- camelCase property naming
- string enum serialization
- UTF-8 JSON payloads.

Use matching contract shapes on both sides of the bridge. TypeScript types help document and check the expected shapes at compile time, while validation of untrusted runtime data remains an application responsibility.

## Window lifecycle and focus

The client tracks lifecycle states:

`Created` → `Loading` → `Ready` → `Visible` / `Hidden` → `Disposed`

`NuiGateway.Bootstrap()` handles the lifecycle hooks, including the page's `ready` signal. `ShowAsync()` and `HideAsync()` provide higher level operations for opening and closing windows while managing focus.

Keyboard ownership can be queried per window.

Keep lifecycle operations consistent with your resource's UI behavior, especially when multiple windows or resources can compete for input focus.

## Diagnostics

Enable diagnostics when you need to inspect communication behavior:

```csharp
var nui = new NuiClient(
    new NuiOptions
    {
        EnableDiagnostics = true
    });

var snapshot = nui.GetDiagnostics();

Console.WriteLine(snapshot);
// Example output:
// Counters: 4, Timings: 2, TotalPayload: 2048, LargestPayload: 1024
```

Diagnostics can expose counters, payload sizes, and timing information, depending on the available metrics.

Protocol logging is controlled by `EnableDebugLogging`. Payload logging is controlled separately by `LogPayloads` and is disabled by default because payloads may contain player input or other sensitive application data.

## Security considerations

NUI messages originate from client side interface and should be treated as untrusted input.

FiveM.Nui provides protocol level safeguards, including:

- graceful handling of malformed JSON.
- error responses for unknown callbacks.
- avoiding the exposure of stack traces to the page.
- opt-in payload logging rather than enabling it by default.

These measures do not replace application level security.

In particular:

- Validate incoming payloads before using them.
- Do not trust client provided prices, permissions, player identifiers, or inventory state.
- Keep authoritative game operations and permission checks on the server.
- Treat successful client side callback as communication result, not proof that server side action is authorized.
- Be careful when logging payloads that may contain sensitive information.

## Performance

The project is designed to keep the messaging path straightforward and predictable.

- Message dispatch avoids reflection.
- Request correlation supports concurrent requests.
- Payload sizes are bounded by the configured limits.
- Diagnostics can be disabled when they are not needed.

Run the benchmark project with:

```bash
dotnet run --project tests/FiveM.Nui.Benchmarks -c Release
```

For performance sensitive workloads, use the supplied benchmarks and measure behavior in your target environment rather than assuming that a particular optimization will improve every workload.

## Testing

Run the C# tests from the repository root:
```bash
dotnet test tests/FiveM.Nui.Tests
```

Run the TypeScript tests:
```bash
cd js/@fivem-nui
npm test
```

The repository also contains integration tests and BenchmarkDotNet benchmarks.

## Documentation
- [TypeScript bridge](js/@fivem-nui/README.md) — installation, API reference, and frontend usage.

## Contributing

Issues and pull requests are welcome.

When contributing:

- Keep changes focused.
- Add or update tests for new behavior.
- Update documentation when public APIs or their behavior change.
- Preserve compatibility between the C# and TypeScript message contracts.

Visit the [FiveM.Nui repository](https://github.com/rian-be/FiveM.Nui) to get started.

## License

FiveM.Nui is licensed under the [MIT License](LICENSE).

Copyright © 2026 Rian.be.
