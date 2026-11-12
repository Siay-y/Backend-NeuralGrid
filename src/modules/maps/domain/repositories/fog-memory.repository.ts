import type { ExploredPoint } from '../value-objects/fog-memory';

export abstract class FogMemoryRepository {
  abstract list(mapId: string): Promise<ExploredPoint[]>;
  abstract count(mapId: string): Promise<number>;
  abstract add(
    mapId: string,
    points: readonly ExploredPoint[],
  ): Promise<ExploredPoint[]>;
  abstract clear(mapId: string): Promise<void>;
}
