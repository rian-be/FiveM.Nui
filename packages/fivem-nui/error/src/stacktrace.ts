/**
 * Stack trace normalization and formatting utilities for FiveM NUI
 */

export interface ParsedStackFrame {
  method?: string;
  file?: string;
  line?: number;
  column?: number;
  raw: string;
}

/**
 * Parses raw stack trace string into structured frames
 */
export function parseStackTrace(stack?: string): ParsedStackFrame[] {
  if (!stack) return [];

  const lines = stack.split('\n');
  const frames: ParsedStackFrame[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip the error message / header line
    if (!trimmed.startsWith('at ') && !trimmed.includes('@')) {
      continue;
    }

    // V8 / CEF style: "at FunctionName (http://nui-game/.../file.js:12:34)" or "at http://...:12:34"
    const v8Match = trimmed.match(/^at\s+(?:(.+?)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))$/);
    if (v8Match) {
      if (v8Match[1]) {
        frames.push({
          method: v8Match[1],
          file: v8Match[2],
          line: Number(v8Match[3]),
          column: Number(v8Match[4]),
          raw: trimmed
        });
      } else {
        frames.push({
          file: v8Match[5],
          line: Number(v8Match[6]),
          column: Number(v8Match[7]),
          raw: trimmed
        });
      }
      continue;
    }

    // Gecko / WebKit style: "method@http://...:12:34"
    const geckoMatch = trimmed.match(/^([^@]*)@(.*?):(\d+):(\d+)$/);
    if (geckoMatch) {
      frames.push({
        method: geckoMatch[1] || undefined,
        file: geckoMatch[2],
        line: Number(geckoMatch[3]),
        column: Number(geckoMatch[4]),
        raw: trimmed
      });
      continue;
    }

    frames.push({ raw: trimmed });
  }

  return frames;
}

/**
 * Cleans up and normalizes stack traces by removing noisy internal CEF / runtime lines
 */
export function formatStackTrace(error: unknown): string {
  if (!error) return '';

  let rawStack = '';
  if (error instanceof Error) {
    rawStack = error.stack || `${error.name}: ${error.message}`;
  } else if (typeof error === 'string') {
    rawStack = error;
  } else if (typeof error === 'object' && error !== null && 'stack' in error) {
    rawStack = String((error as { stack?: unknown }).stack || '');
  }

  if (!rawStack) return '';

  const frames = parseStackTrace(rawStack);
  if (frames.length === 0) return rawStack;

  const formattedLines = frames
    .filter(frame => {
      if (!frame.file) return true;
      // Filter out internal browser extensions or injected scripts if any
      return !frame.file.startsWith('chrome-extension://');
    })
    .map(frame => {
      if (frame.file && frame.line !== undefined) {
        const caller = frame.method ? `at ${frame.method} ` : 'at ';
        return `    ${caller}(${frame.file}:${frame.line}${frame.column !== undefined ? `:${frame.column}` : ''})`;
      }
      return `    ${frame.raw}`;
    });

  const header = error instanceof Error ? `${error.name}: ${error.message}` : 'Error';
  return [header, ...formattedLines].join('\n');
}