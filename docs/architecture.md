# Architecture

## Layout

`FiveM.Nui` is one project under `src/FiveM.Nui/`, split by concern.

- **Abstractions**: `FiveM.Nui.Abstractions`, in `Abstractions/`: the interfaces and DTOs.
- **Core**: `FiveM.Nui` and the `FiveM.Nui.{Callbacks,Common,Diagnostics,Hosting,Lifecycle,Messaging,Serialization,Transport,Windows}` namespaces: the implementations.
- **FiveM adapters**: no separate folder. `FiveMNuiRuntime` lives in `Transport/`, `FiveMNuiLogger` in `Hosting/`, `NuiCallbackBridge` in `Callbacks/`, `NuiGateway` in the project root, and the DI integration `ServiceCollectionExtensions` in `Hosting/` (CitizenFX SDK plus `Microsoft.Extensions.DependencyInjection`).

`Directory.Build.props` applies the shared build settings and global usings to every project.

```
FiveM.Nui/
├── src/
│   └── FiveM.Nui/               # abstractions + core + FiveM adapters, by concern
├── js/
│   └── @fivem-nui/              # TypeScript bridge
├── tests/
│   ├── FiveM.Nui.Tests/         # unit tests
│   └── FiveM.Nui.Benchmarks/    # performance benchmarks
├── tools/
│   └── FiveM.Nui.Contracts/     # C# -> TypeScript contract generator
└── docs/                        # documentation
```

## Components

`NuiClient` implements seven narrow interfaces, so a caller depends only on the operations it uses:

| Interface | Responsibility |
|---|---|
| `INuiMessenger` | Outbound: `SendAsync`, `RequestAsync`, `Publish`. |
| `INuiCallbackServer` | Register and unregister NUI callback handlers. |
| `INuiEventRouter` | Subscribe to NUI-originated events. |
| `INuiInboundHandler` | Accept raw JSON envelopes and trace I/O. |
| `INuiLifecycleObserver` | Drive the NUI page lifecycle (ready, loading, hidden). |
| `INuiDiagnosticsProvider` | Read a diagnostics snapshot. |
| `INuiWindowManager` | Open, close, focus, and unfocus windows; track keyboard ownership. |

`NuiGateway` extends `NuiClient` with `Bootstrap()`, `ShowAsync()` / `HideAsync()`, and static `Run()` / `RegisterCallback()`. Inherited members are used directly, without a `.Client` step.

Behind the interfaces:

- **Transport**: `INuiTransport`, implemented by `FiveMNuiTransport`: send to and receive from NUI through the FiveM API, plus a subscription.
- **Serialization**: `INuiSerializer`, implemented by `NuiJsonSerializer`: `System.Text.Json` with camelCase names, string enums, null handling, and UTF-8.
- **Callbacks**: `INuiCallbackRegistry`: registration, duplicate detection, execution with error handling, and (de)serialization of requests and responses.
- **Windows**: `INuiWindowManager`: open, close, focus, unfocus, keyboard ownership, and active window.
- **Requests**: `ConcurrentRequestManager`: pending requests keyed by correlation ID, with timeouts, cancellation, and cleanup on dispose.
- **Events**: `EventManager`: subscribe and publish, multiple listeners, unsubscribe, and per-listener error isolation.
- **Diagnostics**: `NuiDiagnostics`: optional counters, payload sizes, timings, and snapshots.

### Contract generation

`FiveM.Nui.Contracts` reflects over `[NuiContract]`-marked DTOs and emits the matching TypeScript declarations, so the C# DTOs are the source of truth for the wire contract. It mirrors `NuiJsonSerializer` (camelCase members, string enums) and maps collections, dictionaries, nullability, and generics.

Types marked `[NuiEvent("name")]` also produce a module augmentation of `@fivem-nui/core`'s `NuiEventMap`, which makes the TypeScript client's `request`, `send`, `sendAndWait`, `callback`, `on`, and `once` check the event name and infer the request, response, or payload. A type implementing `INuiRequest<TResponse>` is paired with `TResponse`; otherwise it is a payload, and `Request` / `Response` state the pair explicitly. The attribute is repeatable, so one contract can back several event names. The map is emitted only when at least one event exists and can be turned off with `--no-event-map`; the augmented module is set with `--core-module`. See [Contract generation](contract-generation.md).

XML documentation becomes TSDoc. The generator reads the compiler-generated `.xml` file beside each assembly (or the files passed with the repeatable `--doc` option), turns `<summary>` into `/** ... */` comments on types and members, maps record primary-constructor `<param>` tags onto properties, and flattens inline tags (`<see>`, `<paramref>`, `<c>`, `<para>`). Attributes are matched by type name rather than identity, so the tool tolerates an assembly built against a different `FiveM.Nui` version. The `FiveM.Nui` package also ships an opt-in MSBuild target (`buildTransitive/FiveM.Nui.targets`) that runs the CLI after `Build` when `GenerateNuiContracts` is `true`; the generator is incremental and writes the output next to the project.

## Message flow

### Send (C# → NUI)

```
NuiClient.SendAsync()
  ↓
NuiMessage.CreateEvent()
  ↓
NuiJsonSerializer.Serialize()
  ↓
FiveMNuiTransport.SendAsync()
  ↓
FiveM API (SendNuiMessage)
  ↓
NUI (JavaScript)
```

### Request/response (C# → NUI)

```
NuiClient.RequestAsync()
  ↓
Generate correlation ID
  ↓
Register in ConcurrentRequestManager
  ↓
NuiMessage.CreateRequest()
  ↓
Serialize and send
  ↓
Wait for response (with timeout)
  ↓
ConcurrentRequestManager.CompleteRequest()
  ↓
Deserialize response
  ↓
Return result
```

### Callback (NUI → C#)

```
NUI sends request
  ↓
FiveMNuiTransport receives
  ↓
NuiClient.HandleIncomingMessage()
  ↓
Find handler in NuiCallbackRegistry
  ↓
Execute handler
  ↓
Serialize response
  ↓
Send response to NUI
```

### Event (NUI → C#)

```
NUI sends event
  ↓
FiveMNuiTransport receives
  ↓
NuiClient.HandleIncomingMessage()
  ↓
EventManager.Publish()
  ↓
Notify all subscribers
```

## Threading

- Public APIs are thread-safe.
- `ConcurrentDictionary` for concurrent access.
- `Interlocked` for atomics.
- No shared mutable state on hot paths.

## Error handling

### Serialization

- Malformed JSON returns `null`.
- Exceptions are caught and logged.
- Callbacks return error responses.

### Requests

- A timeout throws `OperationCanceledException`.
- Network errors throw `NuiException`.
- Unhandled callback exceptions return error responses.

### Unknown callbacks

- Error response with code `UNKNOWN_CALLBACK`.
- Log a warning.
- No crash.

## Performance

### Allocations

- Reuse serializer instances.
- Avoid boxing.
- `struct` for small DTOs.

### Dispatch

- Type information is captured at registration.
- Generic delegates for handlers.
- Direct (de)serialization.

### Concurrency

- Async/await for I/O.
- Parallel request handling.
- Non-blocking event dispatch.

## Security

- NUI input is untrusted.
- Payloads are validated on deserialization.
- No stack traces are sent to NUI.
- Errors carry only codes and messages.
- Logging can be disabled.

## Extensibility

### Custom transport

Implement `INuiTransport`:

```csharp
public class CustomTransport : INuiTransport
{
    public Task SendAsync(NuiMessage message, CancellationToken ct)
    {
        // Custom implementation
    }

    public IDisposable Subscribe(Action<NuiMessage> handler)
    {
        // Custom implementation
    }
}
```

### Custom serializer

Implement `INuiSerializer`:

```csharp
public class CustomSerializer : INuiSerializer
{
    public string Serialize<T>(T value)
    {
        // Custom implementation
    }

    public T? Deserialize<T>(string json)
    {
        // Custom implementation
    }
}
```

### Custom logger

Implement `INuiLogger`:

```csharp
public class CustomLogger : INuiLogger
{
    public void LogDebug(string message, params object[] args)
    {
        // Custom implementation
    }

    // ... other methods
}
```
