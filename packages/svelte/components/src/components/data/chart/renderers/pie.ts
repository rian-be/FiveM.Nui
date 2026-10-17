import type { ChartData, ChartOptions } from '../types';
import type { ChartRenderer, RenderContext } from './base';
import { drawMessage } from './base';
import { getColor } from '../color';

/**
 * Renderer for pie and doughnut charts.
 */
export class PieChartRenderer implements ChartRenderer {
  constructor(private readonly isDoughnut: boolean = false) {}

  render(context: RenderContext, data: ChartData, _options: ChartOptions): void {
    const { ctx, width, height } = context;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(10, Math.min(width, height) / 2 - 20);

    // Pie chart uses the first visible dataset
    const dataset = data.datasets.find((d) => !d.hidden) ?? data.datasets[0];
    if (!dataset || dataset.hidden || !dataset.data || dataset.data.length === 0) {
      drawMessage(ctx, width, height, 'Dataset is hidden or empty');
      return;
    }

    const positiveValues = dataset.data.map((v) =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
    );
    const total = positiveValues.reduce((acc, v) => acc + v, 0);

    if (total <= 0) {
      drawMessage(ctx, width, height, 'No positive values for pie chart');
      return;
    }

    let startAngle = -Math.PI / 2;
    positiveValues.forEach((val, idx) => {
      if (val <= 0) return;

      const sliceAngle = (val / total) * (Math.PI * 2);
      const endAngle = startAngle + sliceAngle;
      const color = getColor(dataset.backgroundColor, idx);

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(24, 24, 27, 0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      startAngle = endAngle;
    });

    if (this.isDoughnut) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
