# Messaging

FiveM.Nui supports several messaging patterns. Pick the one that matches the interaction.

| API | Direction | Purpose |
|---|---|---|
| `SendAsync<T>()` | C# → UI | Send a message to the frontend. |
| `Publish<T>()` | C# → UI | Publish a one-way event. |
| `RequestAsync<TReq, TRes>()` | C# → UI | Send a request and await a response. |
| `RegisterCallback<TReq, TRes>()` | UI → C# | Register a C# handler that the UI can invoke. |
| `Subscribe<T>()` | UI → C# | Handle events raised by the frontend. |
| `OpenAsync()` / `CloseAsync()` | Window | Open or close a window. |
| `FocusAsync()` / `UnfocusAsync()` | Input | Acquire or release focus. |

The TypeScript package mirrors these for subscriptions, callbacks, requests, and outgoing messages.

## Events

An event is one-way; the sender does not wait for a response.

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

`Subscribe<T>()` is the C# counterpart for events raised by the frontend.

Events travel in both directions, so give each direction its own name: `player:healthChanged` when the UI notifies C#, `player:healthUpdated` when C# notifies the UI. Keep names and payload contracts identical on both sides.

## Request/response

Use it when the caller needs a result.

The UI sends a request:

```ts
const result = await nui.request<
  UseItemRequest,
  UseItemResponse
>('inventory:use', {
  itemId: 'water',
});
```

C# registers the handler:

```csharp
nui.RegisterCallback<UseItemRequest, UseItemResponse>(
    "inventory:use",
    HandleUseItem);
```

The bridge matches the response to the original request and supports timeouts and cancellation. A timeout does not stop the underlying operation, so design retries with side effects in mind.

## Callbacks in both directions

- **UI → C#**: register a C# callback the frontend can invoke.
- **C# → UI**: register a TypeScript callback that returns a result to the C# caller.

## Wire protocol

Messages are camelCase JSON envelopes.

### Event

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

```json
{
  "id": "e2f6...",
  "type": "request",
  "event": "player:get",
  "payload": {}
}
```

### Success

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

### Failure

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

The bridge routes these messages and matches responses; the payload shapes are defined by your resource.

## Callback execution

Inbound callbacks run concurrently by default. To stop handlers that share state from overlapping:

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

`Serialize` serializes execution of the callback. `SerializationGroup` shares one gate across related callbacks, such as purchase, apply, and cancel when they touch the same state.

## Serialization

The C# side uses `System.Text.Json` with camelCase names, string enums, and UTF-8 payloads. Keep contract shapes identical on both sides. TypeScript types check shapes at compile time; validating untrusted runtime data is still up to the application.
