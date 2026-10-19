---
description: "Comprehensive C# class, method, and options reference for FiveM.Nui (CoreCLR / .NET 10)."
icon: book
---

# 📚 C# API Reference (FiveM.Nui)

> **Technical specification for `NuiGateway`, `NuiClient`, `NuiOptions`, and `NuiResult<T>`.**

---

## 1. `NuiGateway`

Namespace: `FiveM.Nui`  
Inherits: `NuiClient`

Primary entry point for FiveM Enhanced client scripts. Extends `NuiClient` with native FiveM runtime bindings, `Bootstrap` handshakes, and window lifecycle automation.

### Constructor:
```csharp
public NuiGateway(string window, NuiOptions? options = null)
```

### Methods:
* **`Bootstrap(Func<Task>? onReady = null, Func<Task>? onClose = null)`**: Registers the primary envelope callback (`EnvelopeCallback = "nui"`) along with `"ready"` and `"close"` lifecycle hooks.
* **`ShowAsync(string windowName, Func<Task>? onShown = null)`**: Opens the window, acquires focus (`SetNuiFocus(true, true)`), reveals the cursor, and invokes optional `onShown`.
* **`HideAsync(string windowName)`**: Releases focus (`SetNuiFocus(false, false)`), hides the cursor, and closes the window.
* **`Run(Func<Task> action)`** *(static)*: Safely dispatches asynchronous tasks from synchronous contexts (e.g. `[OnCommand]` handlers) with exception logging.

---

## 2. `NuiClient`

Core library class implementing `INuiMessenger`, `INuiCallbackServer`, `INuiEventRouter`, `INuiInboundHandler`, `INuiLifecycleObserver`, `INuiDiagnosticsProvider`, and `INuiWindowManager`.

### Key Methods:
* **`RegisterCallback<TReq, TRes>(string eventName, Func<TReq, CancellationToken, Task<NuiResult<TRes>>> handler, NuiCallbackOptions? options = null)`**: Registers a handler for an incoming NUI RPC request.
* **`Publish<T>(string eventName, T payload)`**: Synchronous fire-and-forget event push to NUI without awaiting confirmation.
* **`SendAsync<T>(string eventName, T payload, CancellationToken cancellationToken = default)`**: Asynchronous event dispatch to NUI.
* **`RequestAsync<TReq, TRes>(string eventName, TReq request, CancellationToken cancellationToken = default)`**: Solicits a response from NUI and awaits the result envelope.
* **`Subscribe<T>(string eventName, Action<T> handler)`**: Subscribes to events pushed from NUI via `nui.send()`.

---

## 3. `NuiOptions`

Configuration options for `NuiGateway` and `NuiClient`:

| Property | Type | Default | Description |
|---|---|---|---|
| `DefaultTimeout` | `TimeSpan` | `30 seconds` | Default deadline for awaiting request responses. |
| `MaxPayloadSize` | `int` | `1048576` (1 MB) | Maximum permitted envelope payload size in bytes. |
| `EnableDiagnostics` | `bool` | `false` | Collects runtime performance metrics and packet counters. |
| `EnableDebugLogging` | `bool` | `false` | Emits message envelope metadata to the client console. |
| `LogPayloads` | `bool` | `false` | Emits raw JSON payloads (use with caution: may log PII). |
| `PendingRequestTimeout`| `TimeSpan` | `5 minutes` | Retention deadline for orphaned coordinator requests. |

---

## 4. `NuiResult<T>`

Standard discriminated union representing success or failure from C# callbacks:
```csharp
// Success:
return NuiResult<BuyResponse>.Ok(new BuyResponse(...));

// Business error:
return NuiResult<BuyResponse>.Fail("ITEM_OUT_OF_STOCK", "The requested item is out of stock.");
```
