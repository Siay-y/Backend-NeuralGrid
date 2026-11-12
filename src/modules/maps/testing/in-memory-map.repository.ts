import type { BattleMap } from '../domain/entities/battle-map';
import type { MapArea } from '../domain/entities/map-area';
import {
  type MapImageKind,
  MapRepository,
  type NewAreaImages,
  type StoredMapImage,
} from '../domain/repositories/map.repository';

interface StoredArea {
  area: MapArea;
  image: StoredMapImage;
  thumbnail: StoredMapImage;
}

export class InMemoryMapRepository extends MapRepository {
  readonly reads: string[] = [];
  private readonly maps = new Map<string, BattleMap>();
  private readonly areas = new Map<string, StoredArea>();

  findAll(): Promise<BattleMap[]> {
    return Promise.resolve([...this.maps.values()]);
  }

  findById(id: string): Promise<BattleMap | null> {
    return Promise.resolve(this.maps.get(id) ?? null);
  }

  findActive(): Promise<BattleMap | null> {
    const map = [...this.maps.values()].find((entry) => entry.active);
    return Promise.resolve(map ?? null);
  }

  count(): Promise<number> {
    return Promise.resolve(this.maps.size);
  }

  totalBytes(): Promise<number> {
    let total = 0;
    for (const row of this.areas.values()) {
      total += row.area.byteSize;
    }
    return Promise.resolve(total);
  }

  findAreas(mapId?: string): Promise<MapArea[]> {
    return Promise.resolve(
      [...this.areas.values()]
        .map((row) => row.area)
        .filter((area) => mapId === undefined || area.mapId === mapId),
    );
  }

  findArea(id: string): Promise<MapArea | null> {
    return Promise.resolve(this.areas.get(id)?.area ?? null);
  }

  async createMap(
    map: BattleMap,
    area: MapArea,
    images: NewAreaImages,
  ): Promise<void> {
    this.maps.set(map.id, map);
    await this.createArea(area, images);
  }

  createArea(area: MapArea, images: NewAreaImages): Promise<void> {
    this.areas.set(area.id, {
      area,
      image: { bytes: images.image, type: area.type },
      thumbnail: { bytes: images.thumbnail, type: images.thumbnailType },
    });
    return Promise.resolve();
  }

  saveMap(map: BattleMap): Promise<void> {
    if (this.maps.has(map.id)) {
      this.maps.set(map.id, map);
    }
    return Promise.resolve();
  }

  saveArea(area: MapArea): Promise<void> {
    const row = this.areas.get(area.id);
    if (row) {
      this.areas.set(area.id, { ...row, area });
    }
    return Promise.resolve();
  }

  setActive(id: string | null): Promise<void> {
    for (const [key, map] of this.maps) {
      this.maps.set(key, map.withActive(key === id));
    }
    return Promise.resolve();
  }

  readImage(
    areaId: string,
    kind: MapImageKind,
  ): Promise<StoredMapImage | null> {
    this.reads.push(`${areaId}:${kind}`);
    const row = this.areas.get(areaId);
    return Promise.resolve(row ? row[kind] : null);
  }

  deleteMap(id: string): Promise<boolean> {
    for (const [key, row] of this.areas) {
      if (row.area.mapId === id) {
        this.areas.delete(key);
      }
    }
    return Promise.resolve(this.maps.delete(id));
  }

  deleteArea(id: string): Promise<boolean> {
    return Promise.resolve(this.areas.delete(id));
  }
}
