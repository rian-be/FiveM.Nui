---
description: "TypeScript API reference for @fivem-nui/core, @fivem-nui/svelte, and @fivem-nui/error."
icon: file-code
---

# TypeScript API Reference

> **Module specifications for `@fivem-nui/core`, `@fivem-nui/svelte`, and `@fivem-nui/error`.**

---

## 1. `@fivem-nui/core`

The core zero-dependency transport bridge communicating with FiveM CEF runtime APIs.

### Exports:
* **`nui` / `NuiClient`**: Main client orchestrating HTTP POST requests (`https://<resource>/<callback>`) and inbound `window.addEventListener('message')` envelopes.
  * `nui.request<K>(event, payload)`: Dispatches an RPC request to C# and returns a Promise with the response.
  * `nui.send(event, payload)`: Dispatches a one-way event to C# (fire-and-forget).
  * `nui.notify(callback, payload)`: Dispatches directly to an explicit native callback endpoint (`ready`, `close`).
  * `nui.callback(event, handler)`: Registers a handler answering reverse RPC calls from C# (`RequestAsync`).
  * `nui.on(event, handler)`: Subscribes to `Publish`/`SendAsync` events from C#.
* **Test Utilities (`@fivem-nui/core/testing`)**:
  * `makeClient()` / `createTestNuiClient()`: Creates an in-memory `TestNuiClient` with virtual transport without FiveM.
    * `testNui.emit(eventName, payload)`: Simulates an inbound event from C# to the frontend.
    * `testNui.deliverResponse(id, success, value, error)`: Resolves a pending `client.request()` promise.
    * `testNui.getSentMessages()`: Returns the recorded history of all sent HTTP POST envelopes.
  * `fakeFetch()`: Captures raw HTTP calls in Vitest/Jest unit tests.

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
