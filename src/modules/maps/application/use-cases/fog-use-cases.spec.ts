import type { MapRepository } from '../../domain/repositories/map.repository';
import { InMemoryFogMemoryRepository } from '../../testing/in-memory-fog-memory.repository';
import { InMemoryFogSettingsRepository } from '../../testing/in-memory-fog-settings.repository';
import {
  ExploreFogUseCase,
  ForgetFogUseCase,
  GetFogMemoryUseCase,
  GetFogUseCase,
  UpdateFogUseCase,
} from './fog-use-cases';

const master = { id: 'm1', role: 'master' as const };
const player = { id: 'p1', role: 'player' as const };
const step = (col: number, row: number) => ({
  from: null,
  to: { col, row, size: 1 },
});

function setup(activeMapId: string | null = 'map-1') {
  const settings = new InMemoryFogSettingsRepository();
  const memory = new InMemoryFogMemoryRepository();
  const maps = {
    findActive: () =>
      Promise.resolve(activeMapId === null ? null : { id: activeMapId }),
  } as unknown as MapRepository;
  return {
    memory,
    get: new GetFogUseCase(settings),
    update: new UpdateFogUseCase(settings),
    getMemory: new GetFogMemoryUseCase(maps, memory),
    explore: new ExploreFogUseCase(settings, maps, memory),
    forget: new ForgetFogUseCase(maps, memory),
  };
}

describe('fog use cases', () => {
  it('starts off with a six square light and no memory, and keeps each change', async () => {
    const { get, update } = setup();
    expect(await get.execute()).toEqual({
      enabled: false,
      radius: 6,
      memory: false,
    });

    await update.execute(master, { enabled: true });
    expect(await update.execute(master, { radius: 10, memory: true })).toEqual({
      enabled: true,
      radius: 10,
      memory: true,
    });
    expect(await get.execute()).toEqual({
      enabled: true,
      radius: 10,
      memory: true,
    });
  });

  it('lets only the master change the fog', async () => {
    const { update } = setup();
    await expect(
      update.execute(player, { enabled: true }),
    ).rejects.toMatchObject({ code: 'MAP_FORBIDDEN' });
  });

  it('keeps the light reach between 2 and 20 whole squares', async () => {
    const { get, update } = setup();
    for (const radius of [1, 21, 4.5, Number.NaN]) {
      await expect(update.execute(master, { radius })).rejects.toMatchObject({
        code: 'INVALID_MAP',
      });
    }
    expect((await get.execute()).radius).toBe(6);
  });

  describe('memory', () => {
    it('remembers only while the fog and the memory are both on', async () => {
      const { update, explore, getMemory } = setup();

      expect(await explore.execute([step(0, 0)])).toBeNull();
      await update.execute(master, { enabled: true });
      expect(await explore.execute([step(0, 0)])).toBeNull();

      await update.execute(master, { memory: true });
      expect(await explore.execute([step(0, 0)])).toEqual({
        mapId: 'map-1',
        points: [1, 1],
      });
      expect(await explore.execute([step(0, 0)])).toBeNull();
      expect(await getMemory.execute()).toEqual({
        mapId: 'map-1',
        points: [1, 1],
      });
    });

    it('needs a map on the table', async () => {
      const { update, explore, getMemory } = setup(null);
      await update.execute(master, { enabled: true, memory: true });

      expect(await explore.execute([step(0, 0)])).toBeNull();
      expect(await getMemory.execute()).toBeNull();
    });

    it('lets only the master forget the explored places', async () => {
      const { update, explore, forget, getMemory } = setup();
      await update.execute(master, { enabled: true, memory: true });
      await explore.execute([step(0, 0), step(5, 5)]);

      await expect(forget.execute(player)).rejects.toMatchObject({
        code: 'MAP_FORBIDDEN',
      });
      expect(await forget.execute(master)).toEqual({
        mapId: 'map-1',
        points: [],
      });
      expect(await getMemory.execute()).toEqual({ mapId: 'map-1', points: [] });
    });
  });
});
