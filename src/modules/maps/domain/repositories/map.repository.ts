import type { BattleMap } from '../entities/battle-map';
import type { MapArea } from '../entities/map-area';

export type MapImageKind = 'image' | 'thumbnail';

export interface StoredMapImage {
  bytes: Buffer;
  type: string;
}

export interface NewAreaImages {
  image: Buffer;
  thumbnail: Buffer;
  thumbnailType: string;
}

export abstract class MapRepository {
  abstract findAll(): Promise<BattleMap[]>;
  abstract findById(id: string): Promise<BattleMap | null>;
  abstract findActive(): Promise<BattleMap | null>;
  abstract count(): Promise<number>;
  abstract totalBytes(): Promise<number>;
  abstract findAreas(mapId?: string): Promise<MapArea[]>;
  abstract findArea(id: string): Promise<MapArea | null>;
  abstract createMap(
    map: BattleMap,
    area: MapArea,
    images: NewAreaImages,
  ): Promise<void>;
  abstract createArea(area: MapArea, images: NewAreaImages): Promise<void>;
  abstract saveMap(map: BattleMap): Promise<void>;
  abstract saveArea(area: MapArea): Promise<void>;
  abstract setActive(id: string | null): Promise<void>;
  abstract readImage(
    areaId: string,
    kind: MapImageKind,
  ): Promise<StoredMapImage | null>;
  abstract deleteMap(id: string): Promise<boolean>;
  abstract deleteArea(id: string): Promise<boolean>;
}
