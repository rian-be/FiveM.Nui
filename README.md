# FiveM.Nui

A strongly typed bridge between C#/.NET FiveM client scripts and NUI frontends.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-10.0-512BD4.svg)](https://dotnet.microsoft.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue.svg)](packages/fivem-nui/core)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](packages/fivem-nui/core)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

FiveM.Nui provides a typed communication layer between a FiveM C# client resource and its NUI frontend. Instead of hand-writing JSON, registering callbacks, and matching requests to responses, you work with C# records, TypeScript types, events, and callbacks.

Keep game logic in C# and build the UI with Svelte, React, Vue, or plain TypeScript.

## Why FiveM.Nui?

- **Typed communication**: use C# records and DTOs alongside TypeScript request and response types.
- **Request/response messaging**: correlate requests with responses and handle timeouts, deadlines, and cancellation.
- **Callbacks in both directions**: let the UI call C# handlers and let C# request data from the UI.
- **Events**: publish one way messages and subscribe to updates without building your own event infrastructure.
- **Window management**: open, close, focus, and unfocus NUI windows through a consistent API.
- **Input ownership**: track keyboard focus ownership per window.
- **Diagnostics**: inspect message counters, payload sizes, and timings when diagnostics are enabled.
- **Structured errors**: handle failures through error codes instead of matching exception messages.
- **No UI framework dependency**: integrate the bridge with your frontend of choice.
- **No runtime dependencies**: the TypeScript package does not require additional runtime packages.

> [!NOTE]
> FiveM.Nui is not yet published on NuGet or npm. Both packages must currently be built from source and referenced locally.

## How it works

A resource has two communicating parts:

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

The frontend POSTs messages to a single FiveM resource callback, `nui` by default. C# dispatches them by envelope type and event name. `NuiGateway.Bootstrap()` wires up the callback and the `ready` and `close` lifecycle hooks; after that, the resource exchanges messages without hand-written transport or request correlation.

> **Scope:** FiveM.Nui is a client-side NUI bridge. It does not replace your server-side game logic, framework, database, or authorization checks. Keep authoritative game operations on the server and validate client-originated requests.

## Requirements

- **.NET 10 SDK** for the C# library.
- **Node.js 22.12.0 or newer** for the TypeScript package.
- **TypeScript 7.x** for TypeScript development and type-checking.

The C# library targets .NET 10 and is built with C# 14. The TypeScript package provides ESM output and declaration files.

## Installation

### C# library

NuGet distribution is planned. Until then, reference the project directly:

```xml
<ItemGroup>
  <ProjectReference Include="path/to/FiveM.Nui.csproj" />
</ItemGroup>
```

Once published, installation will use:

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

The build writes the package output to `dist/`.

Add the local package to your NUI resource's `package.json`:

```json
{
  "dependencies": {
    "@fivem-nui/core": "file:../../js/@fivem-nui"
  }
}
```

Adjust the relative path to your layout, then install:

```bash
npm install
```

## Quick start

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

`InventoryUpdated`, `UseItemRequest`, `UseItemResponse`, and `HealthChanged` are application contracts; `items` and `SetHealth` are your own state and logic.

`NuiGateway` extends `NuiClient` with the FiveM bootstrapping and window helpers. The messaging API is available directly on the gateway.

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

The generics describe the expected payload and response types; they do not validate arbitrary runtime JSON.

The default `nui` instance uses the ambient FiveM resource name. Create a `NuiClient` when you need custom options or an independent lifecycle.

## Documentation

- [Messaging](docs/messaging.md): communication patterns, events, request/response, the wire protocol, and serialization.
- [C# API](docs/Api/csharp-api.md): `NuiClient` / `NuiGateway` reference, error handling, window lifecycle, and diagnostics.
- [TypeScript API](docs/Api/typescript-api.md): frontend error handling and codes.
- [Contract generation](docs/contract-generation.md): generating typed TypeScript from C# DTOs, typed events, TSDoc, and the MSBuild target.
- [Security](docs/security.md): treating NUI input as untrusted.
- [Testing](docs/testing.md): testing your frontend without FiveM using `@fivem-nui/core/testing`.
- [Development](docs/development.md): running tests and benchmarks.
- [Architecture](docs/architecture.md): internal structure and design of the C# library.
- [TypeScript bridge package](js/@fivem-nui/README.md): installation, API reference, and frontend usage.

## Contributing

Issues and pull requests are welcome.

- Keep changes focused.
- Add or update tests for new behavior.
- Update documentation when public APIs or their behavior change.
- Preserve compatibility between the C# and TypeScript message contracts.

## License

FiveM.Nui is licensed under the [MIT License](LICENSE).

Copyright © 2026 Rian.be.
