import type { ChartData, ChartOptions, ChartType } from './types';
import type { ChartRenderer, RenderContext } from './renderers/base';
import { drawMessage } from './renderers/base';
import { BarChartRenderer } from './renderers/bar';
import { LineChartRenderer } from './renderers/line';
import { PieChartRenderer } from './renderers/pie';

const renderers: Map<string, ChartRenderer> = new Map<string, ChartRenderer>([
  ['bar', new BarChartRenderer()],
  ['line', new LineChartRenderer()],
  ['pie', new PieChartRenderer(false)],
  ['doughnut', new PieChartRenderer(true)],
]);

/**
 * Registers or overrides a chart renderer.
 */
export function registerChartRenderer(type: string, renderer: ChartRenderer): void {
  renderers.set(type, renderer);
}

/**
 * Returns the registered renderer for given chart type.
 */
export function getChartRenderer(type: ChartType | string): ChartRenderer | undefined {
  return renderers.get(type);
}

/**
 * Renders chart on the given canvas element with hidpi scaling.
 */
export function renderChart(
  canvasEl: HTMLCanvasElement,
  w: number,
  h: number,
  type: ChartType | string,
  currentData: ChartData | undefined,
  options: ChartOptions = {}
): void {
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvasEl.width = Math.floor(w * dpr);
  canvasEl.height = Math.floor(h * dpr);

  ctx.resetTransform?.();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  if (!currentData || !currentData.datasets || currentData.datasets.length === 0) {
    drawMessage(ctx, w, h, 'No data to display');
    return;
  }

  const renderer = getChartRenderer(type);
  if (!renderer) {
    drawMessage(ctx, w, h, `Unsupported chart type: ${type}`);
    return;
  }

  const context: RenderContext = {
    canvas: canvasEl,
    ctx,
    width: w,
    height: h,
    dpr,
  };

  renderer.render(context, currentData, options);
}
