---
description: "C# 14 programming on CoreCLR: IScript, OnCommand, NuiGateway, Callbacks, Publish, Subscribe, and Windows."
icon: gear
---

# Backend C# 14 & CoreCLR: The `NuiGateway`

> **Coordinate NUI communication in modern C# 14 on FiveM Enhanced based on the reference `comps-demo` architecture.**

---

## 1. Script Entry Point: `IScript` & `[OnCommand]`

In FiveM Enhanced, client scripts implement the `IScript` interface from `CitizenFX.FiveM.Shared.Script`:

```csharp
using CitizenFX.FiveM.Shared;
using CitizenFX.FiveM.Shared.Script;
using CompsDemo.Shared;
using FiveM.Nui;
using FiveM.Nui.Abstractions.Messaging;
using FiveM.Nui.Transport;

namespace CompsDemo.Client;

public class CompsDemoClient : IScript
{
    private const string Resource = "comps-demo";

    // Initialize the NUI gateway
    private readonly NuiGateway _gateway = new(Resource, new NuiOptions
    {
        DefaultTimeout = TimeSpan.FromSeconds(8),
        MaxPayloadSize = 256 * 1024, // 256 KB anti-DoS limit
        EnableDiagnostics = true,
        EnableDebugLogging = true,
        Runtime = new FiveMNuiRuntime(Resource),
    });

    private readonly ShopService _shop = new();
    private readonly List<IDisposable> _subscriptions = [];
    private WindowService? _windows;

    public void Initialize()
    {
        _windows = new WindowService(_gateway);

        // Optional: verbose F8 client console logging for all NUI POST requests
        FiveM.Nui.Callbacks.NuiCallbackBridge.TraceCallbacks = true;

        // 1. NUI handshake and window close hooks
        _gateway.Bootstrap(onReady: OnNuiReadyAsync, onClose: OnNuiCloseAsync);

        // 2. Register callbacks and subscriptions
        RegisterCallbacks();
    }

    [OnCommand("compsdemo", Restricted = false)]
    private void ToggleMenu() => NuiGateway.Run(async () =>
    {
        await _windows!.ToggleAsync();
        if (_windows.IsOpen)
        {
            await _gateway.SendAsync("comps:toast", new ToastDto("info", "Panel opened."));
        }
    });

    private async Task OnNuiReadyAsync()
    {
        // When the NUI page signals 'ready', push the catalog state
        await _gateway.SendAsync("comps:catalog", _shop.BuildCatalog());

        var diagnostics = _gateway.GetDiagnostics();
        SharedAPI.Log.Info($"[{Resource}] NUI ready. {diagnostics}");
    }

    private async Task OnNuiCloseAsync()
    {
        // When the player closes the window or presses ESC, release focus and hide
        await _windows!.HideAsync();
    }
}
```

> [!NOTE]
> **How does the `onReady` & `onClose` Handshake work?**  
> When the Svelte app mounts in Chromium CEF, the `useNuiWindow` controller automatically sends a `nui.notify('ready')` signal (or you can trigger it manually in `main.ts`). This triggers the `onReady` delegate in C#, which pushes the initial state to the client (`SendAsync`).  
> When the player closes the window or presses **Escape**, `useNuiWindow` automatically emits `nui.notify('close')`, which invokes `onClose` and executes `HideAsync`, releasing keyboard focus and restoring character control.

---

## 2. Registering Callbacks (`RegisterCallback`) and `NuiResult<T>`

Callbacks handle incoming requests sent from the NUI frontend via `nui.request`:

```csharp
private void RegisterCallbacks()
{
    // Concurrency guard: prevents rapid double-click race conditions on mutating operations
    var serialized = new NuiCallbackOptions 
    { 
        Serialize = true, 
        SerializationGroup = "comps" 
    };

    _gateway.RegisterCallback<BuyRequest, BuyResponse>("comps:buy", BuyAsync, serialized);
    _gateway.RegisterCallback<SaveSettingsRequest, SaveSettingsResponse>("comps:settings", SaveSettingsAsync, serialized);
    _gateway.RegisterCallback<PingRequest, PongResponse>("comps:ping", PingAsync);

    // Subscribe to one-way client events (nui.send from UI)
    _subscriptions.Add(_gateway.Subscribe<ToastDto>("comps:log", toast =>
        SharedAPI.Log.Info($"[{Resource}] UI: [{toast.Kind}] {toast.Message}")));
}

private Task<NuiResult<BuyResponse>> BuyAsync(BuyRequest request, CancellationToken cancellationToken)
{
    var response = _shop.Buy(request.ItemId, request.Quantity);

    // Success: NuiResult<T>.Ok(...)
    if (response.Success)
    {
        _gateway.Publish("comps:toast", new ToastDto("success", response.Message));
        return Task.FromResult(NuiResult<BuyResponse>.Ok(response));
    }

    // Business failure: NuiResult<T>.Fail(code, message)
    return Task.FromResult(NuiResult<BuyResponse>.Fail("BUY_REJECTED", response.Message));
}
```

> [!TIP]
> Return `NuiResult<T>.Ok(...)` for successful operations and `NuiResult<T>.Fail(code, message)` for business rejections (e.g., insufficient funds). The frontend receives a rejected Promise with error details handled cleanly in `useNuiQuery`.

---

## 3. One-Way Messages: `Publish` vs `SendAsync` vs `Subscribe`

| Method | Direction | Behavior | Best Used For |
|---|---|---|---|
| **`_gateway.Publish(event, payload)`** | C# ➔ UI | Synchronous fire-and-forget, zero `Task` allocations. | High-frequency HUD updates, speedometers, health bars. |
| **`_gateway.SendAsync(event, payload)`** | C# ➔ UI | Asynchronous, returns an awaitable `Task`. | Pushing large catalogs, initial state, or I/O completions. |
| **`_gateway.Subscribe<T>(event, handler)`** | UI ➔ C# | Consumes fire-and-forget `nui.send()` messages. Returns `IDisposable`. | Client logs, telemetry, and player UI interactions without waiting for an answer. |

---

## 4. Reverse RPC: C# → UI (`RequestAsync`)

C# can also solicit decisions from the NUI frontend and await the player's response (e.g. an in-game confirmation modal):

```csharp
[OnCommand("compsdemo_confirm", Restricted = false)]
private void ConfirmCommand() => NuiGateway.Run(ConfirmAsync);

private async Task ConfirmAsync()
{
    if (!_windows!.IsOpen)
    {
        await _windows.ShowAsync();
    }

    try
    {
        // C# sends an RPC request to the frontend and awaits the player's choice:
        var answer = await _gateway.RequestAsync<ConfirmRequest, ConfirmResponse>(
            "comps:confirm",
            new ConfirmRequest(
                Title: "Confirm Purchase",
                Message: "Are you sure you want to proceed with payment?",
                ConfirmLabel: "Proceed",
                CancelLabel: "Cancel"));

        SharedAPI.Log.Info($"[{Resource}] User {(answer.Confirmed ? "confirmed" : "cancelled")}.");
    }
    catch (NuiException exception)
    {
        SharedAPI.Log.Warn($"[{Resource}] Request rejected: {exception.ErrorCode} - {exception.Message}");
    }
    catch (OperationCanceledException)
    {
        SharedAPI.Log.Warn($"[{Resource}] Request timed out awaiting UI answer.");
    }
}
```
On the Svelte side, handle this via `nui.callback('comps:confirm', async (req) => { ... })`.
