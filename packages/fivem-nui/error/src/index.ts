/**
 * Error Handling for FiveM NUI Communication and UI Runtime
 *
 * Provides:
 * - NuiErrorHandler class with retry logic and interceptors
 * - Global error and unhandled rejection listeners (installGlobalErrorHandlers)
 * - Render error capturing (captureRenderError)
 * - Stack trace parsing and normalization (formatStackTrace, parseStackTrace)
 * - Exponential backoff retry mechanism with jitter
 * - Error categorization and history tracking
 */

export * from './types.js';
export * from './stacktrace.js';
export * from './handler.js';
export * from './listeners.js';

import { NuiErrorHandler } from './handler.js';
export default NuiErrorHandler;