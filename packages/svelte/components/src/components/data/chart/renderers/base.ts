import type { ChartData, ChartOptions } from '../types';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

/**
 * Canvas chart renderer interface.
 */
export interface ChartRenderer {
  render(context: RenderContext, data: ChartData, options: ChartOptions): void;
}

/**
 * Draws centered text message on the canvas (eg. empty state).
 */
export function drawMessage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string
): void {
  ctx.fillStyle = '#71717a';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
}
