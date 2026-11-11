export const DRAWING_SHAPES = ['free', 'arrow', 'rect', 'ellipse'] as const;

export type DrawingShape = (typeof DRAWING_SHAPES)[number];

export const DRAWING_COLORS = [
  'chalk',
  'rose',
  'peach',
  'butter',
  'mint',
  'sky',
  'lavender',
] as const;

export type DrawingColor = (typeof DRAWING_COLORS)[number];

export const DRAWING_WIDTHS = [2, 4, 8] as const;

export type DrawingWidth = (typeof DRAWING_WIDTHS)[number];

function includes<T extends string | number>(
  list: readonly T[],
  value: unknown,
): value is T {
  return (list as readonly unknown[]).includes(value);
}

export function isDrawingShape(value: unknown): value is DrawingShape {
  return includes(DRAWING_SHAPES, value);
}

export function isDrawingColor(value: unknown): value is DrawingColor {
  return includes(DRAWING_COLORS, value);
}

export function isDrawingWidth(value: unknown): value is DrawingWidth {
  return includes(DRAWING_WIDTHS, value);
}
