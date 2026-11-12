export interface ExploredPoint {
  x2: number;
  y2: number;
}

export interface LightBox {
  col: number;
  row: number;
  size: number;
}

export interface LightStep {
  from: LightBox | null;
  to: LightBox;
}

export interface FogMemoryView {
  mapId: string;
  points: number[];
}

export const FOG_MEMORY = {
  maxPointsPerMap: 20_000,
  maxPointsPerStep: 64,
} as const;

function center(box: LightBox): { x: number; y: number } {
  return { x: box.col + box.size / 2, y: box.row + box.size / 2 };
}

export function trailPoints(
  steps: readonly LightStep[],
  radius: number,
): ExploredPoint[] {
  const spacing = Math.max(1, radius / 2);
  const seen = new Map<string, ExploredPoint>();
  const add = (x: number, y: number) => {
    const point = { x2: Math.round(x * 2), y2: Math.round(y * 2) };
    seen.set(`${point.x2},${point.y2}`, point);
  };
  for (const { from, to } of steps) {
    const end = center(to);
    if (!from) {
      add(end.x, end.y);
      continue;
    }
    const start = center(from);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const count = Math.min(
      FOG_MEMORY.maxPointsPerStep,
      Math.max(1, Math.ceil(distance / spacing)),
    );
    for (let index = 0; index <= count; index++) {
      const t = index / count;
      add(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
    }
  }
  return [...seen.values()];
}

export function flatten(points: readonly ExploredPoint[]): number[] {
  return points.flatMap(({ x2, y2 }) => [x2, y2]);
}
