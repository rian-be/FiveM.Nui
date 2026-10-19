/**
 * Diagnostic types exposed by `@fivem-nui/core/diagnostics`.
 *
 * `NuiDiagnostics` mirrors the C# `NuiDiagnosticsSnapshot` so both sides of the
 * bridge can be inspected with the same vocabulary.
 *
 * It is type-only: `import` and `import type` both work, and both erase at
 * compile time. See `docs/api/typescript.md` for the import forms.
 */
export type { NuiDiagnostics } from './NuiDiagnostics';
