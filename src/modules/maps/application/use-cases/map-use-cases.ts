import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { BattleMap } from '../../domain/entities/battle-map';
import {
  type CellPoint,
  DEFAULT_CELL_PIXELS,
  MapArea,
  type MapAreaEdit,
  type MapPlacement,
  placeBeside,
  placeCenteredOn,
} from '../../domain/entities/map-area';
import { InvalidMapError } from '../../domain/errors/invalid-map.error';
import { MapLimitError } from '../../domain/errors/map-limit.error';
import { MapNotFoundError } from '../../domain/errors/map-not-found.error';
import { type MapActor, MapPolicy } from '../../domain/policies/map-policy';
import {
  type MapImageKind,
  MapRepository,
  type NewAreaImages,
  type StoredMapImage,
} from '../../domain/repositories/map.repository';
import {
  fitsMapLimits,
  type ImageInfo,
  MAP_LIMITS,
  readImageInfo,
} from '../../domain/value-objects/map-image';
import {
  type MapView,
  type SceneView,
  toMapView,
  toSceneView,
} from '../dtos/map-view';
import { MapEvents } from '../services/map-events';
import { MapImageCache } from '../services/map-image-cache';

export interface UploadAreaInput {
  name: unknown;
  image: Buffer;
  thumbnail: Buffer;
  center?: CellPoint;
}

export interface AddAreaInput extends UploadAreaInput {
  mapId: string;
}

export interface UpdateAreaInput extends MapAreaEdit {
  id: string;
}

export interface MapRemoval {
  id: string;
  wasActive: boolean;
}

interface CheckedUpload {
  info: ImageInfo;
  images: NewAreaImages;
  checksum: string;
}

const MEGABYTE = 1024 * 1024;

function checkUpload(input: UploadAreaInput): CheckedUpload {
  const info = readImageInfo(input.image);
  if (!info) {
    throw new InvalidMapError('Envie uma imagem PNG, JPEG ou WebP');
  }
  if (input.image.length > MAP_LIMITS.imageBytes) {
    throw new InvalidMapError(
      `O mapa pode ter no máximo ${MAP_LIMITS.imageBytes / MEGABYTE} MB`,
    );
  }
  if (!fitsMapLimits(info, MAP_LIMITS.side)) {
    throw new InvalidMapError(
      `O mapa pode ter no máximo ${MAP_LIMITS.side} pixels de cada lado`,
    );
  }
  const thumbnail = readImageInfo(input.thumbnail);
  if (
    !thumbnail ||
    input.thumbnail.length > MAP_LIMITS.thumbnailBytes ||
    !fitsMapLimits(thumbnail, MAP_LIMITS.thumbnailSide)
  ) {
    throw new InvalidMapError('A miniatura do mapa é inválida');
  }
  return {
    info,
    images: {
      image: input.image,
      thumbnail: input.thumbnail,
      thumbnailType: thumbnail.type,
    },
    checksum: createHash('sha256').update(input.image).digest('hex'),
  };
}

async function assertSpaceFor(
  maps: MapRepository,
  bytes: number,
): Promise<void> {
  const total = await maps.totalBytes();
  if (total + bytes > MAP_LIMITS.totalBytes) {
    throw new MapLimitError(
      'O espaço dos mapas acabou. Apague um mapa antigo para enviar outro',
    );
  }
}

function newArea(
  mapId: string,
  name: unknown,
  upload: CheckedUpload,
  placement: MapPlacement,
  hidden: boolean,
): MapArea {
  return MapArea.create({
    id: randomUUID(),
    mapId,
    name,
    type: upload.info.type,
    width: upload.info.width,
    height: upload.info.height,
    byteSize: upload.images.image.length,
    checksum: upload.checksum,
    ...placement,
    hidden,
    now: new Date(),
  });
}

async function viewOf(maps: MapRepository, map: BattleMap): Promise<MapView> {
  return toMapView(map, await maps.findAreas(map.id));
}

async function requireMap(maps: MapRepository, id: string): Promise<BattleMap> {
  const map = await maps.findById(id);
  if (!map) {
    throw new MapNotFoundError();
  }
  return map;
}

async function requireArea(maps: MapRepository, id: string): Promise<MapArea> {
  const area = await maps.findArea(id);
  if (!area) {
    throw new MapNotFoundError('area');
  }
  return area;
}

@Injectable()
export class ListMapsUseCase {
  constructor(private readonly maps: MapRepository) {}

  async execute(actor: MapActor): Promise<MapView[]> {
    if (actor.role !== 'master') {
      return [];
    }
    const [maps, areas] = await Promise.all([
      this.maps.findAll(),
      this.maps.findAreas(),
    ]);
    return maps.map((map) =>
      toMapView(
        map,
        areas.filter((area) => area.mapId === map.id),
      ),
    );
  }
}

@Injectable()
export class GetSceneUseCase {
  constructor(private readonly maps: MapRepository) {}

  async execute(): Promise<SceneView | null> {
    const active = await this.maps.findActive();
    return active ? toSceneView(await viewOf(this.maps, active)) : null;
  }
}

@Injectable()
export class UploadMapUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly events: MapEvents,
  ) {}

  async execute(actor: MapActor, input: UploadAreaInput): Promise<MapView> {
    MapPolicy.assertCanManage(actor);
    const upload = checkUpload(input);
    if ((await this.maps.count()) >= MAP_LIMITS.maps) {
      throw new MapLimitError(
        `A mesa guarda no máximo ${MAP_LIMITS.maps} mapas. Apague um para enviar outro`,
      );
    }
    await assertSpaceFor(this.maps, upload.images.image.length);

    const map = BattleMap.create({
      id: randomUUID(),
      name: input.name,
      now: new Date(),
    });
    const area = newArea(
      map.id,
      map.name,
      upload,
      placeCenteredOn(
        input.center ?? { col: 0, row: 0 },
        upload.info,
        DEFAULT_CELL_PIXELS,
      ),
      false,
    );
    await this.maps.createMap(map, area, upload.images);
    const view = toMapView(map, [area]);
    this.events.uploaded({ map: view, created: true });
    return view;
  }
}

@Injectable()
export class AddMapAreaUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly events: MapEvents,
  ) {}

  async execute(actor: MapActor, input: AddAreaInput): Promise<MapView> {
    MapPolicy.assertCanManage(actor);
    const upload = checkUpload(input);
    const map = await requireMap(this.maps, input.mapId);
    const areas = await this.maps.findAreas(map.id);
    if (areas.length >= MAP_LIMITS.areasPerMap) {
      throw new MapLimitError(
        `Um mapa tem no máximo ${MAP_LIMITS.areasPerMap} áreas`,
      );
    }
    await assertSpaceFor(this.maps, upload.images.image.length);

    const cell = areas.at(-1)?.cell ?? DEFAULT_CELL_PIXELS;
    const placement = input.center
      ? placeCenteredOn(input.center, upload.info, cell)
      : placeBeside(areas, upload.info);
    // A new area stays hidden from the players until the master positions it
    // and reveals it, so the next room is never spoiled while it is set up.
    const area = newArea(map.id, input.name, upload, placement, true);
    await this.maps.createArea(area, upload.images);
    const view = toMapView(map, [...areas, area]);
    this.events.uploaded({ map: view, created: false });
    return view;
  }
}

@Injectable()
export class RenameMapUseCase {
  constructor(private readonly maps: MapRepository) {}

  async execute(
    actor: MapActor,
    input: { id: string; name: unknown },
  ): Promise<MapView> {
    MapPolicy.assertCanManage(actor);
    const map = (await requireMap(this.maps, input.id)).rename(
      input.name,
      new Date(),
    );
    await this.maps.saveMap(map);
    return viewOf(this.maps, map);
  }
}

@Injectable()
export class UpdateMapAreaUseCase {
  constructor(private readonly maps: MapRepository) {}

  async execute(actor: MapActor, input: UpdateAreaInput): Promise<MapView> {
    MapPolicy.assertCanManage(actor);
    const current = await requireArea(this.maps, input.id);
    const next = current.edit(
      {
        name: input.name,
        col: input.col,
        row: input.row,
        cell: input.cell,
        hidden: input.hidden,
      },
      new Date(),
    );
    await this.maps.saveArea(next);
    return viewOf(this.maps, await requireMap(this.maps, next.mapId));
  }
}

@Injectable()
export class ActivateMapUseCase {
  constructor(private readonly maps: MapRepository) {}

  async execute(actor: MapActor, id: string | null): Promise<MapView | null> {
    MapPolicy.assertCanManage(actor);
    if (id === null) {
      await this.maps.setActive(null);
      return null;
    }
    const map = await requireMap(this.maps, id);
    await this.maps.setActive(id);
    return viewOf(this.maps, map.withActive(true));
  }
}

@Injectable()
export class DeleteMapUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly cache: MapImageCache,
  ) {}

  async execute(actor: MapActor, id: string): Promise<MapRemoval> {
    MapPolicy.assertCanManage(actor);
    const map = await requireMap(this.maps, id);
    const areas = await this.maps.findAreas(id);
    if (!(await this.maps.deleteMap(id))) {
      throw new MapNotFoundError();
    }
    areas.forEach((area) => this.cache.deleteArea(area.id));
    return { id, wasActive: map.active };
  }
}

@Injectable()
export class DeleteMapAreaUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly cache: MapImageCache,
  ) {}

  async execute(actor: MapActor, id: string): Promise<MapView> {
    MapPolicy.assertCanManage(actor);
    const area = await requireArea(this.maps, id);
    const areas = await this.maps.findAreas(area.mapId);
    if (areas.length <= 1) {
      throw new InvalidMapError(
        'Um mapa precisa de pelo menos uma área. Apague o mapa inteiro',
      );
    }
    if (!(await this.maps.deleteArea(id))) {
      throw new MapNotFoundError('area');
    }
    this.cache.deleteArea(id);
    const map = await requireMap(this.maps, area.mapId);
    return toMapView(
      map,
      areas.filter((candidate) => candidate.id !== id),
    );
  }
}

@Injectable()
export class ReadMapImageUseCase {
  constructor(
    private readonly maps: MapRepository,
    private readonly cache: MapImageCache,
  ) {}

  async execute(
    actor: MapActor,
    areaId: string,
    kind: MapImageKind,
  ): Promise<StoredMapImage> {
    const area = await this.maps.findArea(areaId);
    const map = area ? await this.maps.findById(area.mapId) : null;
    if (!area || !map || !MapPolicy.canSee(actor, map, area, kind)) {
      throw new MapNotFoundError();
    }
    const key = `${areaId}:${kind}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const image = await this.maps.readImage(areaId, kind);
    if (!image) {
      throw new MapNotFoundError();
    }
    this.cache.set(key, image);
    return image;
  }
}
