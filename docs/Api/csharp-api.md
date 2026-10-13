# C# API

## `NuiClient`

Core messaging.

| Method | Description |
|---|---|
| `SendAsync<T>(event, payload, ct)` | Sends a message to the UI. |
| `RequestAsync<TReq, TRes>(event, request, ct)` | Sends a request and awaits its response. |
| `Publish<T>(event, payload)` | Publishes a one-way event. |
| `RegisterCallback<TReq, TRes>(event, handler, options?)` | Registers a callback for requests from the UI. |
| `UnregisterCallback(event)` | Removes a callback and returns a `bool`. |
| `Subscribe<T>(event, handler)` | Subscribes to events raised by the UI; returns `IDisposable`. |
| `GetDiagnostics()` | Returns a diagnostics snapshot. |

It also exposes the window and focus operations.

## `NuiGateway`

`NuiGateway` adds FiveM integration on top of `NuiClient`.

| Method | Description |
|---|---|
| `Bootstrap(onReady?, onClose?)` | Registers the `nui` callback and lifecycle hooks. |
| `ShowAsync(window, onShown?)` | Opens and focuses a window. |
| `HideAsync(window)` | Releases focus and closes a window. |
| `Run(Func<Task>)` | Runs asynchronous work from a low-level helper. |
| `RegisterCallback(name, Action<string>)` | Registers a callback from raw JSON. |

Use `NuiGateway` for the FiveM helpers, or `NuiClient` for the core messaging API directly.

## Errors

Callbacks return `NuiResult<T>` instead of throwing across the boundary:

```csharp
public sealed record NuiResult<T>
{
    public bool Success { get; init; }
    public T? Value { get; init; }
    public NuiError? Error { get; init; }
}
```

Helpers include `IsFailure`, `ValueOrDefault`, `ValueOrThrow()`, and `FromNullable(...)`.

A failed request throws `NuiException`, which carries an `ErrorCode`:

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

## Window lifecycle and focus

The client tracks these states:

`Created` → `Loading` → `Ready` → `Visible` / `Hidden` → `Disposed`

`Bootstrap()` drives the lifecycle hooks, including the page's `ready` signal. `ShowAsync()` and `HideAsync()` open and close windows while managing focus, and keyboard ownership can be queried per window.

Keep lifecycle operations consistent with your resource's UI behavior, especially when multiple windows can compete for input focus.

## Diagnostics

```csharp
var nui = new NuiClient(
    new NuiOptions
    {
        EnableDiagnostics = true
    });

var snapshot = nui.GetDiagnostics();

Console.WriteLine(snapshot);
// Counters: 4, Timings: 2, TotalPayload: 2048, LargestPayload: 1024
```

Diagnostics expose counters, payload sizes, and timings. `EnableDebugLogging` controls protocol logging; `LogPayloads` controls payload logging and is off by default, since payloads may hold player input or other sensitive data.
