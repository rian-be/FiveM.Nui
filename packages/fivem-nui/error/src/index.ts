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

export * from './types';
export * from './stacktrace';
export * from './handler';
export * from './listeners';
export * from './abort';

import { NuiErrorHandler } from './handler';
export default NuiErrorHandler;