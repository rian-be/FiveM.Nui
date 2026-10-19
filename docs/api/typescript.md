---
description: "TypeScript API reference for @fivem-nui/core, @fivem-nui/svelte, and @fivem-nui/error."
icon: file-code
---

# TypeScript API Reference

> **Module specifications for `@fivem-nui/core`, `@fivem-nui/svelte`, and `@fivem-nui/error`.**

---

## 1. `@fivem-nui/core`

The core zero-dependency transport bridge communicating with FiveM CEF runtime APIs.

### 1.1 Package Entry Points (Subpaths)

`@fivem-nui/core` provides three distinct subpaths so your production bundles never bundle test mocks or diagnostics overhead:

| Import path | Exposes | Use for |
| :--- | :--- | :--- |
| **`@fivem-nui/core`** | `nui`, `NuiClient`, events, callbacks, contracts | Production game UI |
| **`@fivem-nui/core/testing`** | `createTestNuiClient`, `makeClient`, `fakeFetch` | Unit & component tests without FiveM |
| **`@fivem-nui/core/diagnostics`** | `NuiDiagnostics` | Performance telemetry & dev overlay panels |

### 1.2 Core Client API (`@fivem-nui/core`)

* **`nui` / `NuiClient`**: Main client orchestrating HTTP POST requests (`https://<resource>/<callback>`) and inbound `window.addEventListener('message')` envelopes.
  * `nui.request<K>(event, payload, timeout?, signal?)`: Dispatches an RPC request to C# and returns a Promise with the response.
  * `nui.send(event, payload)`: Dispatches a one-way event to C# (fire-and-forget).
  * `nui.sendAndWait(event, payload)`: Dispatches an event and waits for HTTP delivery confirmation.
  * `nui.notify(callback, payload)`: Dispatches directly to an explicit native callback endpoint (e.g. `ready`, `close`).
  * `nui.notifyAndWait(callback, payload)`: Dispatches to a callback endpoint and awaits HTTP confirmation.
  * `nui.callback(event, handler)`: Registers a handler answering reverse RPC calls from C# (`RequestAsync`).
  * `nui.on(event, handler)`: Subscribes to `Publish`/`SendAsync` events from C#.
  * `nui.onWindow(handler)`: Listens for window lifecycle actions (`open`, `close`, `focus`, `unfocus`).
  * `nui.getDiagnostics()`: Returns a snapshot of traffic counters (`sent`, `received`, `resolved`, `rejected`, `failed`).

### 1.3 Diagnostics Telemetry (`@fivem-nui/core/diagnostics`)

`NuiDiagnostics` is a zero-runtime interface describing client activity counters:

```ts
import type { NuiDiagnostics } from '@fivem-nui/core/diagnostics';

const diagnostics: NuiDiagnostics = nui.getDiagnostics();
console.log(`Requests: ${diagnostics.resolved} resolved, ${diagnostics.failed} failed`);
```

### 1.4 Test Utilities (`@fivem-nui/core/testing`)

* `createTestNuiClient(options?)` / `makeClient`: In-memory virtual bridge. See [Testing without FiveM](../developers/testing.md) for full guide.
* `fakeFetch()`: Standalone HTTP mock transport recorder.

---

## 2. `@fivem-nui/svelte`

Svelte 5 integration built natively on the **Runes** reactivity system:

### Exports:
* **`useNuiState<T>(eventName, defaultValue, options?)`**: Reactive state controller synchronized with C# events. Value accessed via `.value`.
* **`useNuiQuery<TReq, TRes>(eventName, options?)`**: Asynchronous query manager tracking `.loading`, `.data`, `.error`, `.status` with `.execute()`, `.refetch()`, and `.abort()`.
* **`useNuiWindow(windowName, options?)`**: Window lifecycle controller with reactive `.visible` state, `.open()`, `.close()`, `.toggle()`, and automatic Escape dismiss.
* **`useEscape(handler)`**: Runes composable invoking a callback when ESC is pressed.
* **`nuiEscapeAction`**, **`nuiFocusTrap`**, **`nuiClickOutside`**: Declarative Svelte actions for DOM elements.
* **`setupNuiMock(options)`**: Initializes an in-browser mock bridge for development outside FiveM.
* **`isNui()`**: Returns `true` when running inside FiveM Chromium CEF.
* **`isBrowser()`**: Returns `true` when running in a standalone browser.

---

## 3. `@fivem-nui/error`

Global error interception and resilient backoff retries:

### Exports:
* **`installGlobalErrorHandlers(options)`**: Captures uncaught exceptions and unhandled Promise rejections in CEF.
* **`withRetry(fn, options)`**: Exponential backoff retry utility with jitter.
* **`NuiRequestError`**: Structured error class thrown on timeouts, aborts, or C# failures.
* **Error Codes (`NuiErrorCodes`)**:
  * `Timeout` - C# did not answer within the configured deadline.
  * `Aborted` - The request was cancelled or the window closed.
  * `Transport` — Network or HTTP error occurred.
