import type { ChartData, ChartOptions } from '../types';
import type { ChartRenderer, RenderContext } from './base';
import { drawMessage } from './base';
import { getColor, colorToRgba } from '../color';
import { calculateScale, drawGridAndYLabels, DEFAULT_CHART_PADDING } from '../scale';

/**
 * Renderer for line charts.
 */
export class LineChartRenderer implements ChartRenderer {
  render(context: RenderContext, data: ChartData, options: ChartOptions): void {
    const { ctx, width, height } = context;
    const padding = DEFAULT_CHART_PADDING;
    const chartW = Math.max(10, width - padding.left - padding.right);
    const chartH = Math.max(10, height - padding.top - padding.bottom);

    const labels = data.labels || [];
    const datasets = data.datasets.filter((d) => !d.hidden);
    if (datasets.length === 0) {
      drawMessage(ctx, width, height, 'All datasets are hidden');
      return;
    }

    const scale = calculateScale(datasets, options, chartH, padding.top);
    drawGridAndYLabels(ctx, padding, chartW, chartH, scale, options);

    const showLabels = options.showLabels !== false;
    const pointCount = Math.max(labels.length, ...datasets.map((d) => d.data.length), 1);
    const stepX = pointCount > 1 ? chartW / (pointCount - 1) : chartW / 2;

    if (showLabels) {
      for (let i = 0; i < pointCount; i++) {
        if (labels[i]) {
          const x = padding.left + i * stepX;
          ctx.fillStyle = '#a1a1aa';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(labels[i], x, padding.top + chartH + 8);
        }
      }
    }

    datasets.forEach((ds, dsIndex) => {
      const color = getColor(ds.borderColor || ds.backgroundColor, dsIndex);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0, ds.borderWidth ?? 2);

      const segments: { x: number; y: number }[][] = [];
      let currentSegment: { x: number; y: number }[] = [];

      for (let i = 0; i < pointCount; i++) {
        const val = ds.data[i];
        if (val !== null && val !== undefined && Number.isFinite(val)) {
          const safeVal = Math.max(scale.minVal, Math.min(scale.maxVal, val));
          const x = padding.left + i * stepX;
          const y = padding.top + chartH - ((safeVal - scale.minVal) / scale.range) * chartH;
          currentSegment.push({ x, y });
        } else {
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
            currentSegment = [];
          }
        }
      }
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }

      segments.forEach((segment) => {
        if (segment.length === 0) return;

        ctx.beginPath();
        segment.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Area fill clipped to baselineY
        ctx.lineTo(segment[segment.length - 1].x, scale.baselineY);
        ctx.lineTo(segment[0].x, scale.baselineY);
        ctx.closePath();
        ctx.fillStyle = colorToRgba(color, 0.1);
        ctx.fill();

        // Render point markers
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        segment.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });
    });
  }
}
