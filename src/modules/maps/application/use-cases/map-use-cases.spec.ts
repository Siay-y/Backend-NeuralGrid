import { MAP_LIMITS } from '../../domain/value-objects/map-image';
import { InMemoryMapRepository } from '../../testing/in-memory-map.repository';
import { type MapView, toPlayerScene, toSceneView } from '../dtos/map-view';
import { type MapUploadEvent, MapEvents } from '../services/map-events';
import { MapImageCache } from '../services/map-image-cache';
import {
  ActivateMapUseCase,
  AddMapAreaUseCase,
  DeleteMapAreaUseCase,
  DeleteMapUseCase,
  GetSceneUseCase,
  ListMapsUseCase,
  ReadMapImageUseCase,
  RenameMapUseCase,
  UpdateMapAreaUseCase,
  UploadMapUseCase,
} from './map-use-cases';

const master = { id: 'm1', role: 'master' as const };
const player = { id: 'p1', role: 'player' as const };

function png(width: number, height: number, padding = 0): Buffer {
  const header = Buffer.alloc(33 + padding);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'latin1');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

function setup() {
  const repository = new InMemoryMapRepository();
  const events = new MapEvents();
  const cache = new MapImageCache();
  const uploads: MapUploadEvent[] = [];
  events.onUploaded((event) => uploads.push(event));
  const upload = new UploadMapUseCase(repository, events);
  const addArea = new AddMapAreaUseCase(repository, events);
  return {
    repository,
    uploads,
    upload,
    addArea,
    list: new ListMapsUseCase(repository),
    scene: new GetSceneUseCase(repository),
    rename: new RenameMapUseCase(repository),
    update: new UpdateMapAreaUseCase(repository),
    activate: new ActivateMapUseCase(repository),
    remove: new DeleteMapUseCase(repository, cache),
    removeArea: new DeleteMapAreaUseCase(repository, cache),
    read: new ReadMapImageUseCase(repository, cache),
    sendMap: (name = 'Covil do dragão', image = png(2100, 1400)) =>
      upload.execute(master, { name, image, thumbnail: png(320, 213) }),
    sendArea: (
      map: MapView,
      name = 'Mais fundo',
      center?: { col: number; row: number },
    ) =>
      addArea.execute(master, {
        mapId: map.id,
        name,
        image: png(1400, 700),
        thumbnail: png(320, 160),
        center,
      }),
  };
}

describe('map use cases', () => {
  it('stores a new map with one visible area centered on the grid', async () => {
    const { sendMap, uploads } = setup();
    const map = await sendMap('  Covil   do dragão  ');

    expect(map).toMatchObject({
      name: 'Covil do dragão',
      active: false,
      areas: [
        {
          name: 'Covil do dragão',
          width: 2100,
          height: 1400,
          cell: 70,
          col: -15,
          row: -10,
          hidden: false,
        },
      ],
    });
    expect(uploads).toEqual([{ map, created: true }]);
  });

  it('adds areas hidden, beside the others or centered where they were dropped', async () => {
    const { sendMap, sendArea, update, uploads } = setup();
    const map = await sendMap();
    await update.execute(master, { id: map.areas[0].id, cell: 100 });

    const beside = await sendArea(map);
    expect(beside.areas[1]).toMatchObject({
      name: 'Mais fundo',
      col: 6,
      row: -10,
      cell: 100,
      hidden: true,
    });

    const dropped = await sendArea(map, 'Torre', { col: 20.4, row: 3 });
    expect(dropped.areas[2]).toMatchObject({ col: 13, row: 0, cell: 100 });
    expect(uploads.at(-1)).toEqual({ map: dropped, created: false });
  });

  it('lets only the master manage maps and areas', async () => {
    const { sendMap, upload, addArea, rename, update, activate, remove, list } =
      setup();
    const map = await sendMap();
    const forbidden = { code: 'MAP_FORBIDDEN' };
    const files = { image: png(10, 10), thumbnail: png(10, 10) };

    await expect(
      upload.execute(player, { name: 'x', ...files }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      addArea.execute(player, { mapId: map.id, name: 'x', ...files }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      rename.execute(player, { id: map.id, name: 'x' }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      update.execute(player, { id: map.areas[0].id, hidden: true }),
    ).rejects.toMatchObject(forbidden);
    await expect(activate.execute(player, map.id)).rejects.toMatchObject(
      forbidden,
    );
    await expect(remove.execute(player, map.id)).rejects.toMatchObject(
      forbidden,
    );
    expect(await list.execute(player)).toEqual([]);
  });

  it('refuses files that are not real images or are too big', async () => {
    const { sendMap, upload } = setup();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const invalid = { code: 'INVALID_MAP' };

    await expect(sendMap('x', svg)).rejects.toMatchObject(invalid);
    await expect(sendMap('x', png(9000, 100))).rejects.toMatchObject(invalid);
    await expect(
      sendMap('x', png(100, 100, MAP_LIMITS.imageBytes)),
    ).rejects.toMatchObject(invalid);
    await expect(
      upload.execute(master, {
        name: 'x',
        image: png(100, 100),
        thumbnail: png(2000, 2000),
      }),
    ).rejects.toMatchObject(invalid);
    await expect(sendMap('   ')).rejects.toMatchObject(invalid);
  });

  it('keeps the library within the map, area and storage limits', async () => {
    const { sendMap, sendArea, repository } = setup();
    let map = await sendMap('Mapa 0', png(100, 100));
    for (let index = 1; index < MAP_LIMITS.areasPerMap; index++) {
      map = await sendArea(map, `Área ${index}`);
    }
    await expect(sendArea(map)).rejects.toMatchObject({ code: 'MAP_LIMIT' });

    for (let index = 1; index < MAP_LIMITS.maps; index++) {
      await sendMap(`Mapa ${index}`, png(100, 100));
    }
    await expect(sendMap('Um a mais')).rejects.toMatchObject({
      code: 'MAP_LIMIT',
    });

    jest
      .spyOn(repository, 'totalBytes')
      .mockResolvedValue(MAP_LIMITS.totalBytes - 10);
    await expect(sendArea(map)).rejects.toMatchObject({ code: 'MAP_LIMIT' });
  });

  it('puts one map on the table and shows players only its visible areas', async () => {
    const { sendMap, sendArea, activate, scene, list } = setup();
    const first = await sendMap('Primeiro');
    const second = await sendArea(await sendMap('Segundo'));

    await activate.execute(master, first.id);
    const shown = await activate.execute(master, second.id);
    const full = toSceneView(shown!);

    expect(full.areas).toEqual([
      expect.objectContaining({ hidden: false }),
      expect.objectContaining({ hidden: true }),
    ]);
    expect(await scene.execute()).toEqual(full);
    expect(toPlayerScene(full)).toEqual({
      id: second.id,
      areas: [
        {
          id: second.areas[0].id,
          width: 2100,
          height: 1400,
          col: -15,
          row: -10,
          cell: 70,
        },
      ],
    });
    expect(
      (await list.execute(master)).filter((map) => map.active),
    ).toHaveLength(1);

    expect(await activate.execute(master, null)).toBeNull();
    expect(await scene.execute()).toBeNull();
  });

  it('validates area edits and renames maps', async () => {
    const { sendMap, update, rename } = setup();
    const map = await sendMap();
    const areaId = map.areas[0].id;

    const edited = await update.execute(master, {
      id: areaId,
      cell: 140,
      col: 2.345,
      hidden: true,
      name: ' Entrada ',
    });
    expect(edited.areas[0]).toMatchObject({
      cell: 140,
      col: 2.35,
      hidden: true,
      name: 'Entrada',
    });
    expect(
      (await rename.execute(master, { id: map.id, name: 'Caverna' })).name,
    ).toBe('Caverna');

    const invalid = { code: 'INVALID_MAP' };
    await expect(
      update.execute(master, { id: areaId, cell: 2 }),
    ).rejects.toMatchObject(invalid);
    await expect(
      update.execute(master, { id: areaId, col: 9999 }),
    ).rejects.toMatchObject(invalid);
    await expect(
      update.execute(master, { id: 'nope', cell: 50 }),
    ).rejects.toMatchObject({ code: 'MAP_NOT_FOUND' });
  });

  it('serves players only the visible areas of the map on the table', async () => {
    const { sendMap, sendArea, activate, read, update } = setup();
    const shown = await sendArea(await sendMap('Na mesa'));
    const prepared = await sendMap('Próxima cena');
    await activate.execute(master, shown.id);
    const [visible, hidden] = shown.areas;
    const notFound = { code: 'MAP_NOT_FOUND' };

    await expect(
      read.execute(player, visible.id, 'image'),
    ).resolves.toMatchObject({ type: 'image/png' });
    await expect(
      read.execute(player, hidden.id, 'image'),
    ).rejects.toMatchObject(notFound);
    await expect(
      read.execute(player, prepared.areas[0].id, 'image'),
    ).rejects.toMatchObject(notFound);
    await expect(
      read.execute(player, visible.id, 'thumbnail'),
    ).rejects.toMatchObject(notFound);
    await expect(
      read.execute(master, hidden.id, 'image'),
    ).resolves.toMatchObject({ type: 'image/png' });

    await update.execute(master, { id: hidden.id, hidden: false });
    await expect(
      read.execute(player, hidden.id, 'image'),
    ).resolves.toMatchObject({ type: 'image/png' });
  });

  it('reads each image once, keeps the last area and forgets deleted ones', async () => {
    const {
      sendMap,
      sendArea,
      activate,
      read,
      remove,
      removeArea,
      repository,
    } = setup();
    const map = await sendArea(await sendMap());
    const [first, second] = map.areas;
    await activate.execute(master, map.id);

    await read.execute(player, first.id, 'image');
    await read.execute(player, first.id, 'image');
    await read.execute(master, first.id, 'image');
    expect(repository.reads).toEqual([`${first.id}:image`]);

    const left = await removeArea.execute(master, second.id);
    expect(left.areas.map((area) => area.id)).toEqual([first.id]);
    await expect(removeArea.execute(master, first.id)).rejects.toMatchObject({
      code: 'INVALID_MAP',
    });

    expect(await remove.execute(master, map.id)).toEqual({
      id: map.id,
      wasActive: true,
    });
    await expect(read.execute(master, first.id, 'image')).rejects.toMatchObject(
      { code: 'MAP_NOT_FOUND' },
    );
  });
});
