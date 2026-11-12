import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BattleMap } from '../../../domain/entities/battle-map';
import { MapArea } from '../../../domain/entities/map-area';
import {
  type MapImageKind,
  MapRepository,
  type NewAreaImages,
  type StoredMapImage,
} from '../../../domain/repositories/map.repository';
import { MapAreaOrmEntity } from './map-area.orm-entity';
import { MapOrmEntity } from './map.orm-entity';

function toMap(row: MapOrmEntity): BattleMap {
  return BattleMap.restore({
    id: row.id,
    name: row.name,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toArea(row: MapAreaOrmEntity): MapArea {
  return MapArea.restore({
    id: row.id,
    mapId: row.mapId,
    name: row.name,
    type: row.imageType,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    checksum: row.checksum,
    col: row.gridCol,
    row: row.gridRow,
    cell: row.cellSize,
    hidden: row.hidden,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function editableColumns(area: MapArea) {
  return {
    name: area.name,
    gridCol: area.col,
    gridRow: area.row,
    cellSize: area.cell,
    hidden: area.hidden,
    updatedAt: area.updatedAt,
  };
}

function areaRow(area: MapArea, images: NewAreaImages) {
  return {
    id: area.id,
    mapId: area.mapId,
    imageType: area.type,
    width: area.width,
    height: area.height,
    byteSize: area.byteSize,
    checksum: area.checksum,
    image: images.image,
    thumbnail: images.thumbnail,
    thumbnailType: images.thumbnailType,
    createdAt: area.createdAt,
    ...editableColumns(area),
  };
}

@Injectable()
export class TypeOrmMapRepository extends MapRepository {
  constructor(
    @InjectRepository(MapOrmEntity)
    private readonly maps: Repository<MapOrmEntity>,
    @InjectRepository(MapAreaOrmEntity)
    private readonly areas: Repository<MapAreaOrmEntity>,
  ) {
    super();
  }

  async findAll(): Promise<BattleMap[]> {
    const rows = await this.maps.find({ order: { createdAt: 'ASC' } });
    return rows.map(toMap);
  }

  async findById(id: string): Promise<BattleMap | null> {
    const row = await this.maps.findOneBy({ id });
    return row ? toMap(row) : null;
  }

  async findActive(): Promise<BattleMap | null> {
    const row = await this.maps.findOneBy({ active: true });
    return row ? toMap(row) : null;
  }

  count(): Promise<number> {
    return this.maps.count();
  }

  async totalBytes(): Promise<number> {
    const total = await this.areas.sum('byteSize');
    return total ?? 0;
  }

  async findAreas(mapId?: string): Promise<MapArea[]> {
    const rows = await this.areas.find({
      where: mapId === undefined ? {} : { mapId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toArea);
  }

  async findArea(id: string): Promise<MapArea | null> {
    const row = await this.areas.findOneBy({ id });
    return row ? toArea(row) : null;
  }

  async createMap(
    map: BattleMap,
    area: MapArea,
    images: NewAreaImages,
  ): Promise<void> {
    await this.maps.manager.transaction(async (manager) => {
      await manager.insert(MapOrmEntity, {
        id: map.id,
        name: map.name,
        active: map.active,
        createdAt: map.createdAt,
        updatedAt: map.updatedAt,
      });
      await manager.insert(MapAreaOrmEntity, areaRow(area, images));
    });
  }

  async createArea(area: MapArea, images: NewAreaImages): Promise<void> {
    await this.areas.insert(areaRow(area, images));
  }

  async saveMap(map: BattleMap): Promise<void> {
    await this.maps.update(
      { id: map.id },
      { name: map.name, updatedAt: map.updatedAt },
    );
  }

  async saveArea(area: MapArea): Promise<void> {
    await this.areas.update({ id: area.id }, editableColumns(area));
  }

  async setActive(id: string | null): Promise<void> {
    await this.maps.manager.transaction(async (manager) => {
      await manager.update(MapOrmEntity, { active: true }, { active: false });
      if (id !== null) {
        await manager.update(MapOrmEntity, { id }, { active: true });
      }
    });
  }

  async readImage(
    areaId: string,
    kind: MapImageKind,
  ): Promise<StoredMapImage | null> {
    const row = await this.areas.findOne({
      where: { id: areaId },
      select: {
        id: true,
        imageType: true,
        thumbnailType: true,
        image: kind === 'image',
        thumbnail: kind === 'thumbnail',
      },
    });
    const bytes = kind === 'image' ? row?.image : row?.thumbnail;
    if (!row || !bytes) {
      return null;
    }
    return {
      bytes,
      type: kind === 'image' ? row.imageType : row.thumbnailType,
    };
  }

  async deleteMap(id: string): Promise<boolean> {
    const result = await this.maps.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async deleteArea(id: string): Promise<boolean> {
    const result = await this.areas.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
