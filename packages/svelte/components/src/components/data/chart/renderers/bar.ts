import type { ChartData, ChartOptions } from '../types';
import type { ChartRenderer, RenderContext } from './base';
import { drawMessage } from './base';
import { getColor } from '../color';
import { calculateScale, drawGridAndYLabels, DEFAULT_CHART_PADDING } from '../scale';

/**
 * Renderer for bar and column charts.
 */
export class BarChartRenderer implements ChartRenderer {
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
    const groupCount = Math.max(labels.length, ...datasets.map((d) => d.data.length), 1);
    const groupW = chartW / groupCount;
    const totalBarWidth = (groupW * 0.7) / datasets.length;
    const barGap = Math.min(4, totalBarWidth * 0.2);

    for (let g = 0; g < groupCount; g++) {
      const groupX = padding.left + g * groupW;

      if (showLabels && labels[g]) {
        ctx.fillStyle = '#a1a1aa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(labels[g], groupX + groupW / 2, padding.top + chartH + 8);
      }

      datasets.forEach((ds, dsIndex) => {
        const val = ds.data[g];
        if (val === null || val === undefined || !Number.isFinite(val)) {
          return;
        }

        const clampedVal = Math.max(scale.minVal, Math.min(scale.maxVal, val));
        const valY = padding.top + chartH - ((clampedVal - scale.minVal) / scale.range) * chartH;
        const barX = groupX + (groupW - totalBarWidth * datasets.length) / 2 + dsIndex * totalBarWidth;

        let barY: number;
        let barH: number;
        if (clampedVal >= 0) {
          barY = valY;
          barH = scale.baselineY - valY;
        } else {
          barY = scale.baselineY;
          barH = valY - scale.baselineY;
        }

        if (barH <= 0) return;

        const barWidth = Math.max(1, totalBarWidth - barGap);
        ctx.fillStyle = getColor(ds.backgroundColor, dsIndex);

        const r = Math.min(4, barH / 2, barWidth / 2);
        ctx.beginPath();
        if (clampedVal >= 0) {
          ctx.moveTo(barX, scale.baselineY);
          ctx.lineTo(barX, barY + r);
          ctx.quadraticCurveTo(barX, barY, barX + r, barY);
          ctx.lineTo(barX + barWidth - r, barY);
          ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + r);
          ctx.lineTo(barX + barWidth, scale.baselineY);
        } else {
          ctx.moveTo(barX, scale.baselineY);
          ctx.lineTo(barX, barY + barH - r);
          ctx.quadraticCurveTo(barX, barY + barH, barX + r, barY + barH);
          ctx.lineTo(barX + barWidth - r, barY + barH);
          ctx.quadraticCurveTo(barX + barWidth, barY + barH, barX + barWidth, barY + barH - r);
          ctx.lineTo(barX + barWidth, scale.baselineY);
        }
        ctx.closePath();
        ctx.fill();
      });
    }
  }
}
