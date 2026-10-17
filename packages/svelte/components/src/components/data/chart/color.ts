export const DEFAULT_COLORS = [
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

let helperCtx: CanvasRenderingContext2D | null = null;

function getHelperCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!helperCtx) {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    helperCtx = canvas.getContext('2d', { willReadFrequently: true });
  }
  return helperCtx;
}

/**
 * Returns valid color string from dataset property or fallback palette.
 */
export function getColor(item: string | string[] | undefined, index: number): string {
  const safeIdx = Number.isFinite(index) ? Math.floor(Math.abs(index)) : 0;
  if (Array.isArray(item) && item.length > 0) {
    const color = item[safeIdx % item.length];
    if (typeof color === 'string' && color.trim()) {
      return color.trim();
    }
  }
  if (typeof item === 'string' && item.trim()) {
    return item.trim();
  }
  return DEFAULT_COLORS[safeIdx % DEFAULT_COLORS.length];
}

/**
 * Converts color (hex, rgb, hsl, named) to rgba(r, g, b, alpha).
 */
export function colorToRgba(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  if (!color || typeof color !== 'string') return `rgba(99, 102, 241, ${a})`;
  const trimmed = color.trim();

  // Fast path for hex formats: #RGB or #RRGGBB
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Fast path for rgb(...) or rgba(...)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i);
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${a})`;
  }

  // Canvas parser for named colors, hsl, etc.
  const ctx = getHelperCtx();
  if (ctx) {
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = trimmed;
      ctx.fillRect(0, 0, 1, 1);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${a})`;
    } catch {
      // Fallback on environment error
    }
  }

  return `rgba(99, 102, 241, ${a})`;
}
