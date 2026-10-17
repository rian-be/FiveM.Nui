import type { ChartData, ChartDataset } from './types';

export interface ChartValidationResult {
  valid: boolean;
  data?: ChartData;
  error?: string;
}

/**
 * Validates chart data structure (especially useful for NUI game events).
 */
export function validateChartData(raw: unknown): ChartValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Chart data must be an object' };
  }

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.datasets)) {
    return { valid: false, error: 'Missing datasets array' };
  }

  const labels = Array.isArray(obj.labels)
    ? obj.labels.map((l) => (l !== null && l !== undefined ? String(l) : ''))
    : [];

  const datasets: ChartDataset[] = [];
  for (let i = 0; i < obj.datasets.length; i++) {
    const ds = obj.datasets[i];
    if (!ds || typeof ds !== 'object') {
      return { valid: false, error: `Dataset at index ${i} is not a valid object` };
    }

    const dsObj = ds as Record<string, unknown>;
    const label = typeof dsObj.label === 'string' ? dsObj.label : `Dataset ${i + 1}`;

    if (!Array.isArray(dsObj.data)) {
      return { valid: false, error: `Dataset '${label}' is missing data array` };
    }

    const data: (number | null | undefined)[] = [];
    for (let j = 0; j < dsObj.data.length; j++) {
      const v = dsObj.data[j];
      if (v === null || v === undefined) {
        data.push(null);
      } else if (typeof v === 'number' && Number.isFinite(v)) {
        data.push(v);
      } else {
        return {
          valid: false,
          error: `Dataset '${label}' contains invalid value at index ${j}: ${String(v)} (expected finite number or null)`,
        };
      }
    }

    let borderWidth: number | undefined = undefined;
    if (dsObj.borderWidth !== undefined) {
      if (typeof dsObj.borderWidth !== 'number' || !Number.isFinite(dsObj.borderWidth) || dsObj.borderWidth < 0) {
        return { valid: false, error: `Dataset '${label}' has invalid borderWidth (must be number >= 0)` };
      }
      borderWidth = dsObj.borderWidth;
    }

    let backgroundColor: string | string[] | undefined = undefined;
    if (typeof dsObj.backgroundColor === 'string') {
      backgroundColor = dsObj.backgroundColor;
    } else if (Array.isArray(dsObj.backgroundColor)) {
      if (dsObj.backgroundColor.some((c) => typeof c !== 'string' || !c.trim())) {
        return { valid: false, error: `Dataset '${label}' has invalid colors in backgroundColor` };
      }
      backgroundColor = dsObj.backgroundColor as string[];
    }

    let borderColor: string | string[] | undefined = undefined;
    if (typeof dsObj.borderColor === 'string') {
      borderColor = dsObj.borderColor;
    } else if (Array.isArray(dsObj.borderColor)) {
      if (dsObj.borderColor.some((c) => typeof c !== 'string' || !c.trim())) {
        return { valid: false, error: `Dataset '${label}' has invalid colors in borderColor` };
      }
      borderColor = dsObj.borderColor as string[];
    }

    datasets.push({
      label,
      data,
      backgroundColor,
      borderColor,
      borderWidth,
      hidden: typeof dsObj.hidden === 'boolean' ? dsObj.hidden : false,
    });
  }

  if (datasets.length === 0) {
    return { valid: false, error: 'datasets array cannot be empty' };
  }

  return { valid: true, data: { labels, datasets } };
}
