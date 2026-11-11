import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { User } from '../../../users/domain/entities/user';
import { Username } from '../../../users/domain/value-objects/username';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import { SheetForbiddenError } from '../../domain/errors/sheet-forbidden.error';
import { SheetLimitError } from '../../domain/errors/sheet-limit.error';
import { SheetNotFoundError } from '../../domain/errors/sheet-not-found.error';
import type { SheetActor } from '../../domain/policies/sheet-policy';
import { InMemorySheetRepository } from '../../testing/in-memory-sheet.repository';
import {
  CreateSheetUseCase,
  DeleteSheetUseCase,
  ListSheetsUseCase,
  SheetOwnerValidator,
  SHEETS_PER_PLAYER,
  UpdateSheetUseCase,
} from './sheet-use-cases';

const master: SheetActor = { id: 'master-1', role: 'master' };
const player: SheetActor = { id: 'player-1', role: 'player' };
const otherPlayer: SheetActor = { id: 'player-2', role: 'player' };

const named = (name: string) => ({ identity: { name } });

describe('sheet use cases', () => {
  let create: CreateSheetUseCase;
  let update: UpdateSheetUseCase;
  let remove: DeleteSheetUseCase;
  let list: ListSheetsUseCase;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    for (const actor of [master, player, otherPlayer]) {
      await users.save(
        User.create({
          id: actor.id,
          username: Username.create(actor.id),
          displayName: actor.id,
          role: actor.role,
          passwordHash: 'hash',
          now: new Date(),
        }),
      );
    }
    const sheets = new InMemorySheetRepository();
    const owners = new SheetOwnerValidator(new GetUserByIdUseCase(users));
    create = new CreateSheetUseCase(sheets, owners);
    update = new UpdateSheetUseCase(sheets, owners);
    remove = new DeleteSheetUseCase(sheets);
    list = new ListSheetsUseCase(sheets);
  });

  it('gives a player their own agent sheet', async () => {
    const sheet = await create.execute(player, { data: named('Kian') });

    expect(sheet).toMatchObject({
      ownerId: 'player-1',
      kind: 'agent',
      version: 1,
    });
    await expect(
      create.execute(player, { kind: 'threat', data: named('Monstro') }),
    ).rejects.toBeInstanceOf(SheetForbiddenError);
  });

  it('shows players only their own sheets and the master all of them', async () => {
    await create.execute(player, { data: named('Kian') });
    await create.execute(otherPlayer, { data: named('Bia') });
    await create.execute(master, { kind: 'threat', data: named('Sangue') });

    expect(
      (await list.execute(player)).map((s) => s.data.identity.name),
    ).toEqual(['Kian']);
    expect(await list.execute(master)).toHaveLength(3);
  });

  it('caps how many sheets a player can create', async () => {
    for (let index = 0; index < SHEETS_PER_PLAYER; index++) {
      await create.execute(player, { data: named(`Agente ${index}`) });
    }

    await expect(
      create.execute(player, { data: named('Mais um') }),
    ).rejects.toBeInstanceOf(SheetLimitError);
    expect(
      (await create.execute(master, { data: named('NPC') })).ownerId,
    ).toBeNull();
  });

  it('lets owners and the master edit, and hides it from everyone else', async () => {
    const { id } = await create.execute(player, { data: named('Kian') });

    const hurt = await update.execute(master, {
      id,
      data: { status: { hp: { current: 5, max: 20 } } },
    });
    expect(hurt.sheet.data.status.hp.current).toBe(5);
    expect(hurt.sheet.version).toBe(2);
    expect(hurt.identityChanged).toBe(false);

    const renamed = await update.execute(player, {
      id,
      data: { identity: { name: 'Kian Ferreira' } },
    });
    expect(renamed.identityChanged).toBe(true);

    await expect(
      update.execute(otherPlayer, { id, data: { goal: 'roubar' } }),
    ).rejects.toBeInstanceOf(SheetNotFoundError);
    await expect(
      update.execute(player, { id, ownerId: 'player-2' }),
    ).rejects.toBeInstanceOf(SheetForbiddenError);
  });

  it('reports the previous owner when the master hands a sheet over', async () => {
    const { id } = await create.execute(player, { data: named('Kian') });

    const change = await update.execute(master, { id, ownerId: 'player-2' });

    expect(change.previousOwnerId).toBe('player-1');
    expect(change.identityChanged).toBe(true);
    expect(change.sheet.ownerId).toBe('player-2');
    expect(await list.execute(player)).toEqual([]);
  });

  it('lets the owner or the master delete a sheet', async () => {
    const { id } = await create.execute(player, { data: named('Kian') });

    await expect(remove.execute(otherPlayer, id)).rejects.toBeInstanceOf(
      SheetNotFoundError,
    );
    expect(await remove.execute(player, id)).toEqual({
      id,
      ownerId: 'player-1',
    });
  });
});
