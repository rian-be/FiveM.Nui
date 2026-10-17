import type { ChartData, ChartOptions } from './types';

export interface ScaleInfo {
  minVal: number;
  maxVal: number;
  range: number;
  baselineY: number;
}

export interface ChartPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_CHART_PADDING: ChartPadding = {
  top: 20,
  right: 20,
  bottom: 35,
  left: 45,
};

/**
 * Calculates Y axis scale supporting both positive and negative values.
 */
export function calculateScale(
  datasets: ChartData['datasets'],
  options: ChartOptions,
  chartH: number,
  paddingTop: number = DEFAULT_CHART_PADDING.top
): ScaleInfo {
  let dataMin = Infinity;
  let dataMax = -Infinity;
  let hasValidData = false;

  for (const ds of datasets) {
    if (ds.hidden) continue;
    for (const val of ds.data) {
      if (typeof val === 'number' && Number.isFinite(val)) {
        hasValidData = true;
        if (val < dataMin) dataMin = val;
        if (val > dataMax) dataMax = val;
      }
    }
  }

  if (!hasValidData) {
    dataMin = 0;
    dataMax = 10;
  }

  const userMinValid = typeof options.min === 'number' && Number.isFinite(options.min);
  const userMaxValid = typeof options.max === 'number' && Number.isFinite(options.max);

  let minVal: number;
  let maxVal: number;

  if (userMinValid && userMaxValid) {
    if (options.min! < options.max!) {
      minVal = options.min!;
      maxVal = options.max!;
    } else {
      console.warn(
        `[NuiChart] Invalid scale configuration: min (${options.min}) >= max (${options.max}). Falling back to auto range.`
      );
      minVal = dataMin < 0 ? Math.floor(dataMin * 1.15) : 0;
      maxVal = dataMax > 0 ? Math.ceil(dataMax * 1.15) : 10;
    }
  } else if (userMinValid) {
    minVal = options.min!;
    maxVal = Math.max(minVal + 1, dataMax > 0 ? Math.ceil(dataMax * 1.15) : 10);
  } else if (userMaxValid) {
    maxVal = options.max!;
    minVal = Math.min(maxVal - 1, dataMin < 0 ? Math.floor(dataMin * 1.15) : 0);
  } else {
    // Auto scale covering zero
    minVal = dataMin < 0 ? Math.floor(dataMin * 1.15) : 0;
    maxVal = dataMax > 0 ? Math.ceil(dataMax * 1.15) : 10;
  }

  if (minVal >= maxVal) {
    maxVal = minVal + 10;
  }

  const range = maxVal - minVal;
  const rawZeroY = paddingTop + chartH - ((0 - minVal) / range) * chartH;
  const baselineY = Math.max(paddingTop, Math.min(paddingTop + chartH, rawZeroY));

  return { minVal, maxVal, range, baselineY };
}

/**
 * Draws horizontal grid lines, Y axis labels, and highlighted zero baseline.
 */
export function drawGridAndYLabels(
  ctx: CanvasRenderingContext2D,
  padding: ChartPadding,
  chartW: number,
  chartH: number,
  scale: ScaleInfo,
  options: ChartOptions
): void {
  const showGrid = options.showGrid !== false;
  const showLabels = options.showLabels !== false;
  const gridSteps = 4;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = scale.minVal + (scale.range / gridSteps) * i;
    const y = padding.top + chartH - ((yVal - scale.minVal) / scale.range) * chartH;

    if (showGrid) {
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
    }

    if (showLabels) {
      ctx.fillText(Math.round(yVal).toString(), padding.left - 8, y);
    }
  }

  // Highlight zero baseline if range covers both negative and positive values
  if (scale.minVal < 0 && scale.maxVal > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(padding.left, scale.baselineY);
    ctx.lineTo(padding.left + chartW, scale.baselineY);
    ctx.stroke();
  }
}
