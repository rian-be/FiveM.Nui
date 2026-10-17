/**
 * Supported Canvas chart types.
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut';

/**
 * Single dataset to render on a chart.
 */
export interface ChartDataset {
  /** Dataset label displayed in the legend and accessibility attributes. */
  label: string;

  /**
   * Numerical values for the dataset.
   * `null` or `undefined` indicates a missing data point.
   */
  data: (number | null | undefined)[];

  /**
   * Background color for bars, slices, or area fill.
   * Accepts any valid CSS color string or an array of colors.
   */
  backgroundColor?: string | string[];

  /**
   * Border color for lines or bars.
   * Accepts any valid CSS color string or an array of colors.
   */
  borderColor?: string | string[];

  /**
   * Border / line width in pixels.
   * @defaultValue 2
   */
  borderWidth?: number;

  /**
   * Whether the dataset is initially hidden.
   * @defaultValue false
   */
  hidden?: boolean;
}

/**
 * Chart input data structure.
 */
export interface ChartData {
  /** Category labels for the X axis or slice labels for pie/doughnut. */
  labels: string[];

  /** Array of datasets to render. */
  datasets: ChartDataset[];
}

/**
 * Chart rendering, grid, scale, and accessibility options.
 */
export interface ChartOptions {
  /**
   * Legend position configuration.
   * @defaultValue { position: 'bottom' }
   */
  legend?: {
    position?: 'top' | 'bottom' | 'none';
  };

  /**
   * Backward compatible plugin configuration.
   */
  plugins?: {
    legend?: {
      position?: 'top' | 'bottom' | 'none';
    };
  };

  /**
   * Whether to render horizontal grid lines.
   * @defaultValue true
   */
  showGrid?: boolean;

  /**
   * Whether to show axis labels.
   * @defaultValue true
   */
  showLabels?: boolean;

  /**
   * Forced value for the Y axis scale.
   */
  min?: number;
  max?: number;

  /**
   * Accessible description for screen readers.
   */
  ariaLabel?: string;
}
