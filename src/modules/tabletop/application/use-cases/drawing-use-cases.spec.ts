import { Drawing, DRAWING_LIMIT } from '../../domain/entities/drawing';
import { DrawingForbiddenError } from '../../domain/errors/drawing-forbidden.error';
import { DrawingLimitError } from '../../domain/errors/drawing-limit.error';
import type { TableActor } from '../../domain/policies/token-policy';
import { InMemoryDrawingRepository } from '../../testing/in-memory-drawing.repository';
import { ClearDrawingsUseCase } from './clear-drawings.use-case';
import { CreateDrawingUseCase } from './create-drawing.use-case';
import { EraseDrawingsUseCase } from './erase-drawings.use-case';
import { ListDrawingsUseCase } from './list-drawings.use-case';

const master: TableActor = { id: 'master-1', role: 'master' };
const player: TableActor = { id: 'player-1', role: 'player' };
const otherPlayer: TableActor = { id: 'player-2', role: 'player' };

const stroke = {
  shape: 'free',
  color: 'mint',
  width: 2,
  points: [0, 0, 1, 1, 2, 1],
};

describe('drawing use cases', () => {
  let drawings: InMemoryDrawingRepository;
  let create: CreateDrawingUseCase;
  let erase: EraseDrawingsUseCase;
  let clear: ClearDrawingsUseCase;
  let list: ListDrawingsUseCase;

  beforeEach(() => {
    drawings = new InMemoryDrawingRepository();
    create = new CreateDrawingUseCase(drawings);
    erase = new EraseDrawingsUseCase(drawings);
    clear = new ClearDrawingsUseCase(drawings);
    list = new ListDrawingsUseCase(drawings);
  });

  it('lets anyone draw and shows every drawing to everyone', async () => {
    const mine = await create.execute(player, stroke);
    await create.execute(master, {
      ...stroke,
      shape: 'rect',
      points: [0, 0, 3, 2],
    });

    expect(mine).toMatchObject({ authorId: 'player-1', color: 'mint' });
    expect(await list.execute()).toHaveLength(2);
  });

  it('stops at the drawing limit of the table', async () => {
    for (let index = 0; index < DRAWING_LIMIT; index++) {
      await drawings.save(
        Drawing.create({
          id: `drawing-${index}`,
          authorId: 'master-1',
          ...stroke,
          now: new Date(),
        }),
      );
    }

    await expect(create.execute(player, stroke)).rejects.toBeInstanceOf(
      DrawingLimitError,
    );
  });

  it('lets players erase only their own drawings', async () => {
    const mine = await create.execute(player, stroke);
    const theirs = await create.execute(otherPlayer, stroke);

    await expect(
      erase.execute(player, [mine.id, theirs.id]),
    ).rejects.toBeInstanceOf(DrawingForbiddenError);
    expect(await list.execute()).toHaveLength(2);

    expect(await erase.execute(player, [mine.id, mine.id])).toEqual({
      by: 'player-1',
      ids: [mine.id],
    });
    expect(await erase.execute(master, [theirs.id, 'gone'])).toEqual({
      by: 'master-1',
      ids: [theirs.id],
    });
  });

  it('clears the own drawings for anyone and all of them only for the master', async () => {
    const mine = await create.execute(player, stroke);
    await create.execute(otherPlayer, stroke);
    await create.execute(master, stroke);

    expect((await clear.execute(player, 'mine')).ids).toEqual([mine.id]);
    await expect(clear.execute(player, 'all')).rejects.toBeInstanceOf(
      DrawingForbiddenError,
    );
    expect((await clear.execute(master, 'all')).ids).toHaveLength(2);
    expect(await list.execute()).toEqual([]);
  });
});
