import { FogMemoryRepository } from '../domain/repositories/fog-memory.repository';
import type { ExploredPoint } from '../domain/value-objects/fog-memory';

export class InMemoryFogMemoryRepository extends FogMemoryRepository {
  private readonly maps = new Map<string, Map<string, ExploredPoint>>();

  list(mapId: string): Promise<ExploredPoint[]> {
    return Promise.resolve([...(this.maps.get(mapId)?.values() ?? [])]);
  }

  count(mapId: string): Promise<number> {
    return Promise.resolve(this.maps.get(mapId)?.size ?? 0);
  }

  add(
    mapId: string,
    points: readonly ExploredPoint[],
  ): Promise<ExploredPoint[]> {
    const stored = this.maps.get(mapId) ?? new Map<string, ExploredPoint>();
    this.maps.set(mapId, stored);
    const added: ExploredPoint[] = [];
    for (const point of points) {
      const key = `${point.x2},${point.y2}`;
      if (!stored.has(key)) {
        stored.set(key, { ...point });
        added.push({ ...point });
      }
    }
    return Promise.resolve(added);
  }

  clear(mapId: string): Promise<void> {
    this.maps.delete(mapId);
    return Promise.resolve();
  }
}
