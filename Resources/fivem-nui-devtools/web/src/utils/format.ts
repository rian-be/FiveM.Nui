import type { ChartMetric, DiagnosticsSample } from '../types';

export const finite = (val: unknown): number =>
  typeof val === 'number' && Number.isFinite(val) ? val : 0;

export function formatBytes(val: number): string {
  if (val >= 1_073_741_824) return `${(val / 1_073_741_824).toFixed(1)} GB`;
  if (val >= 1_048_576) return `${(val / 1_048_576).toFixed(1)} MB`;
  if (val >= 1_024) return `${(val / 1_024).toFixed(1)} KB`;
  return `${Math.round(val)} B`;
}

export const formatRate = (val: number): string =>
  val >= 100 ? val.toFixed(0) : val.toFixed(1);

export function resourceGroup(state: string): 'started' | 'transitioning' | 'inactive' {
  const norm = state.toLowerCase();
  if (norm === 'started') return 'started';
  if (norm === 'starting' || norm === 'stopping') return 'transitioning';
  return 'inactive';
}

export function chartGeometry(
  history: DiagnosticsSample[],
  metric: ChartMetric
): { line: string; fill: string } {
  const width = 600;
  const height = 58;
  const values = history.map((s) => finite(s[metric]));
  if (values.length === 0) {
    return { line: `0,${height}`, fill: `0,${height} ${width},${height}` };
  }
  const maximum = Math.max(...values, 1);
  const divisor = Math.max(values.length - 1, 1);
  const line = values
    .map(
      (val, idx) =>
        `${((idx / divisor) * width).toFixed(1)},${(height - (val / maximum) * (height - 6) - 3).toFixed(1)}`
    )
    .join(' ');
  return { line, fill: `0,${height} ${line} ${width},${height}` };
}
