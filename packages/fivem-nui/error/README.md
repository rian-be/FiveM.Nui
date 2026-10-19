# @fivem-nui/error

> Structured error handling, categorization, exponential backoff retries, and global runtime listeners for FiveM NUI.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/rian-be/FiveM.Nui/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.12.0-brightgreen.svg)](#requirements)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.x-blue.svg)](#requirements)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](#requirements)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

`@fivem-nui/error` is a lightweight, framework-agnostic error handling toolkit designed specifically for FiveM NUI applications and UI runtimes. It complements [FiveM.Nui](../../../README.md) and [`@fivem-nui/core`](../core/README.md) by capturing uncaught exceptions, unhandled promise rejections, and component render failures, while offering robust exponential backoff retries for transient NUI network calls.

---

## Highlights

- **Global listeners**: Automatically intercept `window.onerror` and `window.onunhandledrejection` inside FiveM CEF.
- **Smart error categorization**: Classify errors into `NETWORK`, `TIMEOUT`, `CALLBACK`, `VALIDATION`, `SCRIPT`, `UNHANDLED_REJECTION`, or `RENDER`.
- **Exponential backoff with jitter**: Retry transient operations and FiveM POST callbacks reliably without hammering the client.
- **CEF stack trace normalization**: Parse V8/Chromium stack strings into structured frames (`file`, `line`, `col`, `method`) and strip extension noise.
- **Render error capture**: Framework-agnostic helpers (`captureRenderError`) for Svelte, React, Vue, Solid, or vanilla DOM boundaries.
- **Interceptors pipeline**: Tap into error lifecycles to enrich context, log to remote diagnostics, or suppress handled errors.
- **In-memory history**: Track the last $N$ errors for in-game debug overlays or dev console inspect panels.
- **Zero runtime dependencies**: Pure TypeScript / ESM with zero third-party baggage.

---

## Requirements

- **Node.js**: `>= 22.12.0`
- **TypeScript**: `7.x` (package includes ESM output and full `.d.ts` declaration files)
- **Environment**: Browser / Chromium Embedded Framework (CEF) within FiveM client

---

## Installation

Install the package from npm:

```bash
npm install @fivem-nui/error
```

Or add it to your `package.json`:

```json
{
  "dependencies": {
    "@fivem-nui/error": "^1.0.0"
  }
}
```

---

## Quick Start

### 1. Install global error listeners

Attach listeners once at your application bootstrap (e.g., `main.ts` or `index.ts`):

```ts
import { installGlobalErrorHandlers } from '@fivem-nui/error';

const uninstall = installGlobalErrorHandlers({
  // Invoked on every captured error
  onCaptured: (errorInfo) => {
    console.error(`[NUI Error: ${errorInfo.category}]`, errorInfo.error);

    // Display on an in-game fatal error overlay during development
    const banner = document.getElementById('fatal-banner');
    if (banner) {
      banner.textContent = `[${errorInfo.category}] ${errorInfo.error}`;
      banner.style.display = 'block';
    }
  }
});

// Optionally uninstall when tearing down or during HMR:
// uninstall();
```

### 2. Retry transient requests with exponential backoff

Wrap requests to C# or external services with retry resilience:

```ts
import { withRetry, NuiErrorCategory } from '@fivem-nui/error';
import { nui } from '@fivem-nui/core';

// Wrap any async operation with retry logic
const fetchPlayerData = withRetry(
  async (playerId: string) => {
    return await nui.request('player:getData', { playerId });
  },
  {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    retryOnTimeout: true,
    retryOnNetworkError: true
  }
);

const player = await fetchPlayerData('player_123');
```

---

## Core Features

### Global Error Handling (`installGlobalErrorHandlers`)

Inside FiveM CEF, unhandled errors or unhandled promise rejections can fail silently without visible feedback in standard game chat. `installGlobalErrorHandlers` hooks into `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')` to provide centralized tracking.

```ts
import { installGlobalErrorHandlers, NuiErrorCategory } from '@fivem-nui/error';

installGlobalErrorHandlers({
  // Suppress default console error spam if needed (calls event.preventDefault())
  preventConsoleLogging: false,

  // Ignore noisy non-critical errors
  filter: (error, event) => {
    const msg = error instanceof Error ? error.message : String(error);
    return !msg.includes('ResizeObserver loop completed');
  },

  // Custom heuristic for UI render issues
  isRenderError: (error, event) => {
    return error instanceof Error && error.message.includes('HydrationError');
  },

  // Callback on capture
  onCaptured: (info) => {
    console.warn(`Captured ${info.category} error at ${info.source}:${info.lineno}`);
  }
});
```

### Error Categories & Severities

Errors are automatically classified into logical categories and assigned severities:

```ts
import { NuiErrorCategory, NuiErrorSeverity } from '@fivem-nui/error';
```

#### `NuiErrorCategory`

| Category | Typical Cause |
|---|---|
| `NETWORK` | `Failed to fetch`, `ECONNREFUSED`, `NetworkError` |
| `TIMEOUT` | Request deadline exceeded, `TimeoutError` |
| `CALLBACK` | FiveM native invoke failures or missing callback handler |
| `VALIDATION` | Schema or contract validation failures (`ValidationError`, `ZodError`) |
| `SCRIPT` | Javascript runtime errors (`TypeError`, `ReferenceError`, `SyntaxError`) |
| `UNHANDLED_REJECTION` | Unhandled asynchronous promise rejection |
| `RENDER` | Component render, lifecycle, mount/unmount or DOM hydration error |
| `UNKNOWN` | Unclassified generic failure |

#### `NuiErrorSeverity`

- `NuiErrorSeverity.INFO` (`'info'`)
- `NuiErrorSeverity.WARNING` (`'warning'`)
- `NuiErrorSeverity.ERROR` (`'error'`)
- `NuiErrorSeverity.FATAL` (`'fatal'`)

---

### Retry Mechanism (`NuiErrorHandler.retry` / `withRetry`)

Network and NUI callback requests can fail when the FiveM client resource is still loading or restarting. The retry mechanism uses exponential backoff combined with randomized jitter to prevent thundering herd problems.

> **Abort Handling:** If an operation is aborted via `AbortSignal` or throws an `AbortError`, retries are immediately terminated without waiting for subsequent attempts.

```ts
import { globalErrorHandler } from '@fivem-nui/error';

const data = await globalErrorHandler.retry(
  async () => {
    const response = await fetch('https://my_resource/query');
    if (!response.ok) throw new Error('Failed to fetch');
    return response.json();
  },
  {
    maxRetries: 4,         // Max number of retries (default: 3)
    baseDelay: 1000,       // Starting delay in ms (default: 1000)
    maxDelay: 10000,       // Max delay ceiling in ms (default: 10000)
    backoffFactor: 2,      // Exponential multiplier (default: 2)
    jitter: 1000,          // Random jitter added to delay (default: 1000)
    retryOnTimeout: true,  // Automatically retry on timeout (default: true)
    retryOnNetworkError: true, // Automatically retry on network error (default: true)
    shouldRetry: (info) => {
      // Optional custom condition
      return info.category === NuiErrorCategory.NETWORK;
    }
  }
);
```

---

### Interceptors Pipeline

Add interceptors to the error handler to enrich errors, send telemetry back to C#, or suppress handled errors:

```ts
import { globalErrorHandler, type NuiErrorInfo } from '@fivem-nui/error';
import { nui } from '@fivem-nui/core';

// Interceptor 1: Append client-side game state
const removeTelemetry = globalErrorHandler.addInterceptor((info) => {
  info.context = {
    ...info.context,
    url: window.location.href,
    userAgent: navigator.userAgent
  };
  return info;
});

// Interceptor 2: Send fatal errors to FiveM C# client script
globalErrorHandler.addInterceptor(async (info) => {
  if (info.severity === 'fatal' || info.category === 'RENDER') {
    try {
      nui.notify('diagnostics:error', {
        category: info.category,
        message: info.error instanceof Error ? info.error.message : String(info.error),
        stack: info.stack
      });
    } catch {
      // Ignore transport errors while reporting errors
    }
  }
  return info;
});

// Interceptor 3: Suppress specific handled errors by returning null
globalErrorHandler.addInterceptor((info) => {
  if (info.error instanceof Error && info.error.message.includes('IGNORED_CODE')) {
    return null; // Suppresses propagation
  }
  return info;
});
```

---

### Component & Render Error Handling (`captureRenderError`)

Capture errors from UI component boundaries without coupling to a specific frontend framework:

```ts
import { captureRenderError } from '@fivem-nui/error';

// Svelte boundary / try-catch
try {
  renderWidget();
} catch (err) {
  await captureRenderError(err, 'InventoryGrid', { slotId: 4 });
}

// React Error Boundary
// componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//   captureRenderError(error, 'ReactRoot', { componentStack: errorInfo.componentStack });
// }
```

---

### Stack Trace Normalization (`parseStackTrace`, `formatStackTrace`)

FiveM CEF stack traces often include ugly URLs or browser extension internals. `@fivem-nui/error` cleans and parses them into structured frames:

```ts
import { parseStackTrace, formatStackTrace } from '@fivem-nui/error';

const frames = parseStackTrace(error.stack);
// frames = [
//   {
//     method: 'renderComponent',
//     file: 'http://nui-inventory/dist/bundle.js',
//     line: 142,
//     column: 15,
//     raw: 'at renderComponent (http://nui-inventory/dist/bundle.js:142:15)'
//   }
// ]

const cleanStack = formatStackTrace(error);
console.log(cleanStack);
```

---

### In-Memory Error History

Retrieve recent errors for in-game diagnostic HUDs or developer panels:

```ts
import { globalErrorHandler } from '@fivem-nui/error';

// Fetch recent errors (capped to maxHistorySize, default: 100)
const history = globalErrorHandler.getErrorHistory();

console.log(`Recorded ${history.length} errors so far.`);

// Clear the buffer
globalErrorHandler.clearHistory();
```

To create an isolated error handler instance with custom history size:

```ts
import { createErrorHandler } from '@fivem-nui/error';

const customHandler = createErrorHandler({
  maxHistory: 50,
  interceptors: [
    (info) => {
      console.log('Custom handler caught:', info.operation);
      return info;
    }
  ]
});
```

---

## API Reference

### Classes & Instances

| Export | Type | Description |
|---|---|---|
| `NuiErrorHandler` | Class | Main error handling engine with interceptors, history, categorization, and retry capabilities. |
| `globalErrorHandler` | `NuiErrorHandler` | Shared singleton instance used by default across listeners and retry wrappers. |
| `default` | `NuiErrorHandler` | Default export of the class. |

### Functions

| Function | Signature | Description |
|---|---|---|
| `installGlobalErrorHandlers(options?)` | `(options?: GlobalErrorListenerOptions) => () => void` | Attaches `window.onerror` and `window.onunhandledrejection` listeners. Returns uninstall function. |
| `captureRenderError(error, component?, context?, handler?)` | `Promise<NuiErrorInfo \| null>` | Captures component-level rendering or lifecycle errors. |
| `withRetry(fn, options?)` | `(...args) => Promise<T>` | Decorates any async function with exponential backoff retry. |
| `createErrorHandler(options?)` | `(options?) => NuiErrorHandler` | Factory function to construct custom `NuiErrorHandler` instances. |
| `parseStackTrace(stack?)` | `(stack?: string) => ParsedStackFrame[]` | Parses raw V8 / CEF or WebKit stack trace strings into structured objects. |
| `formatStackTrace(error)` | `(error: unknown) => string` | Cleans up and formats stack traces, removing noisy extension lines. |
| `defaultIsRenderError(error, message)` | `(error: unknown, message: string) => boolean` | Heuristic checking if an error is related to DOM / rendering lifecycle keywords. |
| `isAbortError(error)` | `(error: unknown) => boolean` | Checks if an error is an `AbortError` (DOMException or named Error). |
| `createAbortablePromise(promise, signal?)` | `(promise: Promise<T>, signal?: AbortSignal) => Promise<T>` | Wraps a promise with an `AbortSignal` listener for immediate cancellation. |

---

## Development

```bash
# Build TypeScript to dist/
npm run build

# Watch mode for active development
npm run watch

# Type-check without emitting files
npm run check
```

---

## Contributing

Contributions, bug reports, and improvements are welcome! Please submit issues or pull requests at [github.com/rian-be/FiveM.Nui](https://github.com/rian-be/FiveM.Nui).

---

## License

[MIT](../../../LICENSE) © 2026 Rian.be
