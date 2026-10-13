# TypeScript API

`@fivem-nui/core` is the frontend bridge. Its installation steps and full API reference are in the [package README](../../js/@fivem-nui/README.md). This page covers errors.

## Error handling

Failed operations reject with `NuiRequestError`. Narrow it with `isNuiRequestError()` and read `error.code`:

| Code | Meaning |
|---|---|
| `UNKNOWN_CALLBACK` | No matching callback is registered. |
| `CALLBACK_ERROR` | A callback failed while processing a request. |
| `TIMEOUT` | A request exceeded its deadline. |
| `POST_TIMEOUT` | A POST operation exceeded its timeout. |
| `TRANSPORT` | A transport-level failure occurred. |
| `DISPOSED` | The client has been disposed. |
| `UNKNOWN_ERROR` | An unexpected error occurred. |

A timeout rejects the waiting operation but does not cancel the underlying work.
