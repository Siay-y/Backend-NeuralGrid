import { InMemoryFogSettingsRepository } from '../../testing/in-memory-fog-settings.repository';
import { GetFogUseCase, UpdateFogUseCase } from './fog-use-cases';

const master = { id: 'm1', role: 'master' as const };
const player = { id: 'p1', role: 'player' as const };

function setup() {
  const repository = new InMemoryFogSettingsRepository();
  return {
    get: new GetFogUseCase(repository),
    update: new UpdateFogUseCase(repository),
  };
}

describe('fog use cases', () => {
  it('starts off with a six square light and keeps each change', async () => {
    const { get, update } = setup();
    expect(await get.execute()).toEqual({ enabled: false, radius: 6 });

    await update.execute(master, { enabled: true });
    expect(await update.execute(master, { radius: 10 })).toEqual({
      enabled: true,
      radius: 10,
    });
    expect(await get.execute()).toEqual({ enabled: true, radius: 10 });
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
});
