---
description: "Wire protocol specification, JSON envelope format, UUIDv7 correlation, and timeouts."
icon: network-wired
---

# 🌐 Network Wire Protocol Specification

> **Message formatting details between C# CoreCLR and the Chromium CEF web runtime.**

---

## 1. Message Envelope Format (`NuiMessage`)

All communication between C# and NUI is transmitted as a uniform JSON envelope:

```json
{
  "id": "018d9f12-7a3b-7f11-9e22-123456789abc",
  "type": "request",
  "event": "shop:buy",
  "payload": {
    "itemId": "bread",
    "quantity": 2
  },
  "success": true,
  "error": null
}
```

### Envelope Fields:
* **`id`** (`string?`): Unique correlation identifier generated as a **UUIDv7** (time-ordered, monotonic). Used to correlate `request` envelopes with `response` envelopes.
* **`type`** (`string`): Message discriminant:
  * `"event"` — One-way broadcast (fire-and-forget).
  * `"request"` — RPC call awaiting an answer.
  * `"response"` — Answer to a preceding request.
  * `"open"` / `"close"` / `"focus"` / `"unfocus"` — Window lifecycle envelopes.
* **`event`** (`string`): Domain event name or window name.
* **`payload`** (`object?`): Message data serialized in `camelCase`.
* **`success`** (`bool`): Outcome flag on response envelopes.
* **`error`** (`NuiError?`): Error object (`code` and `message`) on failure.

---

## 2. Transport Channels

1. **C# ➔ NUI**:
   Dispatched via the native FiveM runtime call `Native.SendNuiMessage(json)`. The frontend receives messages via `window.addEventListener('message')`.
2. **NUI ➔ C#**:
   Dispatched from the browser via `window.fetch("https://<resourceName>/nui", { method: 'POST', body: json })`. C# intercepts incoming envelopes via `NuiCallbackBridge`.
