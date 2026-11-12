import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { User } from '../../../users/domain/entities/user';
import { Username } from '../../../users/domain/value-objects/username';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import { InvalidTokenError } from '../../domain/errors/invalid-token.error';
import { TokenForbiddenError } from '../../domain/errors/token-forbidden.error';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import type { TableActor } from '../../domain/policies/token-policy';
import { InMemoryTokenRepository } from '../../testing/in-memory-token.repository';
import { toSheetView } from '../../../sheets/application/dtos/sheet-view';
import { FindSheetUseCase } from '../../../sheets/application/use-cases/sheet-use-cases';
import { CharacterSheet } from '../../../sheets/domain/entities/character-sheet';
import { InMemorySheetRepository } from '../../../sheets/testing/in-memory-sheet.repository';
import { TokenOwnerValidator } from '../services/token-owner-validator';
import { TokenSheetLink } from '../services/token-sheet-link';
import { AuthorizeTokenDragUseCase } from './authorize-token-drag.use-case';
import { CreateTokenUseCase } from './create-token.use-case';
import { DeleteTokenUseCase } from './delete-token.use-case';
import { ListTokensUseCase } from './list-tokens.use-case';
import { MoveTokenUseCase } from './move-token.use-case';
import { SyncSheetTokensUseCase } from './sync-sheet-tokens.use-case';
import { UpdateTokenUseCase } from './update-token.use-case';

const master: TableActor = { id: 'master-1', role: 'master' };
const player: TableActor = { id: 'player-1', role: 'player' };
const otherPlayer: TableActor = { id: 'player-2', role: 'player' };

const agentInput = {
  label: 'Dante',
  kind: 'agent' as const,
  icon: null,
  sex: null,
  hidden: false,
  nameHidden: false,
  emitsLight: true,
  ownerId: 'player-1',
  sheetId: null,
  col: 0,
  row: 0,
  size: 1,
};

describe('token use cases', () => {
  let tokens: InMemoryTokenRepository;
  let create: CreateTokenUseCase;
  let update: UpdateTokenUseCase;
  let move: MoveTokenUseCase;
  let drag: AuthorizeTokenDragUseCase;
  let remove: DeleteTokenUseCase;
  let list: ListTokensUseCase;
  let sheetStore: InMemorySheetRepository;
  let sync: SyncSheetTokensUseCase;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    for (const [id, role] of [
      ['master-1', 'master'],
      ['player-1', 'player'],
      ['player-2', 'player'],
    ] as const) {
      await users.save(
        User.create({
          id,
          username: Username.create(id),
          displayName: id,
          role,
          passwordHash: 'hash',
          now: new Date(),
        }),
      );
    }

    tokens = new InMemoryTokenRepository();
    const owners = new TokenOwnerValidator(new GetUserByIdUseCase(users));
    sheetStore = new InMemorySheetRepository();
    const sheets = new TokenSheetLink(new FindSheetUseCase(sheetStore));
    sync = new SyncSheetTokensUseCase(tokens);
    create = new CreateTokenUseCase(tokens, owners, sheets);
    update = new UpdateTokenUseCase(tokens, owners, sheets);
    move = new MoveTokenUseCase(tokens);
    drag = new AuthorizeTokenDragUseCase(tokens);
    remove = new DeleteTokenUseCase(tokens);
    list = new ListTokensUseCase(tokens);
  });

  describe('create', () => {
    it('lets the master place a token', async () => {
      const token = await create.execute(master, agentInput);

      expect(token).toMatchObject({
        label: 'Dante',
        ownerId: 'player-1',
        version: 1,
      });
      expect(await tokens.findById(token.id)).not.toBeNull();
    });

    it('refuses players', async () => {
      await expect(create.execute(player, agentInput)).rejects.toBeInstanceOf(
        TokenForbiddenError,
      );
    });

    it('refuses an owner who is not part of the table', async () => {
      await expect(
        create.execute(master, { ...agentInput, ownerId: 'stranger' }),
      ).rejects.toBeInstanceOf(InvalidTokenError);
    });
  });

  describe('move', () => {
    it('lets a player move a token they own', async () => {
      const { id } = await create.execute(master, agentInput);

      const moved = await move.execute(player, { id, col: 3, row: 4 });

      expect(moved).toMatchObject({ col: 3, row: 4, version: 2 });
    });

    it("blocks a player from moving someone else's token", async () => {
      const { id } = await create.execute(master, agentInput);

      await expect(
        move.execute(otherPlayer, { id, col: 1, row: 1 }),
      ).rejects.toBeInstanceOf(TokenForbiddenError);
    });

    it('lets the master move any token', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        ownerId: null,
      });

      await expect(
        move.execute(master, { id, col: 9, row: 9 }),
      ).resolves.toMatchObject({
        col: 9,
      });
    });

    it('reports a token that no longer exists', async () => {
      await expect(
        move.execute(master, { id: 'missing', col: 0, row: 0 }),
      ).rejects.toBeInstanceOf(TokenNotFoundError);
    });
  });

  describe('drag preview', () => {
    it('applies the same ownership rule without persisting', async () => {
      const { id } = await create.execute(master, agentInput);

      await expect(
        drag.execute(player, { id, col: 2, row: 2 }),
      ).resolves.toEqual({
        preview: { id, by: 'player-1', col: 2, row: 2 },
        hidden: false,
      });
      await expect(
        drag.execute(otherPlayer, { id, col: 2, row: 2 }),
      ).rejects.toBeInstanceOf(TokenForbiddenError);
      expect((await tokens.findById(id))?.col).toBe(0);
    });
  });

  describe('update and delete', () => {
    it('lets the master hand a token to another player', async () => {
      const { id } = await create.execute(master, agentInput);

      const updated = await update.execute(master, {
        id,
        ownerId: 'player-2',
        size: 2,
      });

      expect(updated).toMatchObject({
        token: { ownerId: 'player-2', size: 2, label: 'Dante' },
        wasHidden: false,
      });
    });

    it('refuses edits and removals from players', async () => {
      const { id } = await create.execute(master, agentInput);

      await expect(
        update.execute(player, { id, label: 'X' }),
      ).rejects.toBeInstanceOf(TokenForbiddenError);
      await expect(remove.execute(player, id)).rejects.toBeInstanceOf(
        TokenForbiddenError,
      );
    });

    it('removes a token for the master', async () => {
      const { id } = await create.execute(master, agentInput);

      await expect(remove.execute(master, id)).resolves.toEqual({
        id,
        wasHidden: false,
      });
      await expect(remove.execute(master, id)).rejects.toBeInstanceOf(
        TokenNotFoundError,
      );
    });
  });

  describe('tokens linked to a sheet', () => {
    const kian = CharacterSheet.create({
      id: 'sheet-kian',
      ownerId: 'player-1',
      kind: 'agent',
      data: {
        identity: { name: 'Kian Ferreira', codename: 'Corvo', sex: 'male' },
      },
      now: new Date(),
    });

    beforeEach(() => sheetStore.save(kian));

    it('takes the name, kind, sex and owner from the sheet', async () => {
      const token = await create.execute(master, {
        ...agentInput,
        label: 'Outro',
        kind: 'npc',
        ownerId: null,
        sheetId: kian.id,
      });

      expect(token).toMatchObject({
        label: 'Corvo',
        kind: 'agent',
        sex: 'male',
        ownerId: 'player-1',
        sheetId: kian.id,
      });
    });

    it('ignores edits to what the sheet decides, and frees them when unlinked', async () => {
      const { id } = await create.execute(master, agentInput);

      const linked = await update.execute(master, { id, sheetId: kian.id });
      const renamed = await update.execute(master, { id, label: 'X', size: 2 });
      const unlinked = await update.execute(master, {
        id,
        sheetId: null,
        label: 'Livre',
      });

      expect(linked.token).toMatchObject({ label: 'Corvo', sheetId: kian.id });
      expect(renamed.token).toMatchObject({ label: 'Corvo', size: 2 });
      expect(unlinked.token).toMatchObject({
        label: 'Livre',
        sheetId: null,
        ownerId: 'player-1',
      });
    });

    it('refuses a sheet that does not exist', async () => {
      await expect(
        create.execute(master, { ...agentInput, sheetId: 'missing' }),
      ).rejects.toBeInstanceOf(InvalidTokenError);
    });

    it('follows the sheet when it changes and skips tokens already in sync', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        sheetId: kian.id,
      });
      await create.execute(master, { ...agentInput, label: 'Solto' });

      const unchanged = await sync.execute(toSheetView(kian));
      const handed = kian.edit(
        {
          data: { identity: { name: 'Kian', codename: '' } },
          ownerId: 'player-2',
        },
        new Date(),
      );
      const synced = await sync.execute(toSheetView(handed));

      expect(unchanged).toEqual([]);
      expect(synced).toHaveLength(1);
      expect(synced[0]).toMatchObject({
        token: {
          id,
          label: 'Kian',
          sex: null,
          ownerId: 'player-2',
          version: 2,
        },
        wasHidden: false,
      });
    });

    it('hides the token and its name when the sheet says so, and ignores the token toggles', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        sheetId: kian.id,
      });

      const hiddenSheet = kian.edit(
        { hidden: true, nameHidden: true },
        new Date(),
      );
      await sheetStore.save(hiddenSheet);
      const [change] = await sync.execute(toSheetView(hiddenSheet));
      const forced = await update.execute(master, { id, hidden: false });

      expect(change).toMatchObject({
        token: { hidden: true, nameHidden: true },
        wasHidden: false,
      });
      expect(forced.token).toMatchObject({ hidden: true, nameHidden: true });
    });
  });

  describe('hidden tokens', () => {
    it('lists them only for the master', async () => {
      await create.execute(master, { ...agentInput, label: 'Visível' });
      await create.execute(master, {
        ...agentInput,
        label: 'Dragão',
        icon: 'dragon-head',
        hidden: true,
      });

      const forMaster = await list.execute(master);
      const forPlayer = await list.execute(player);

      expect(forMaster.map((token) => token.label).sort()).toEqual([
        'Dragão',
        'Visível',
      ]);
      expect(forPlayer.map((token) => token.label)).toEqual(['Visível']);
    });

    it('treats a hidden token as missing for players, even its owner', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        hidden: true,
      });

      await expect(
        move.execute(player, { id, col: 1, row: 1 }),
      ).rejects.toBeInstanceOf(TokenNotFoundError);
      await expect(
        drag.execute(player, { id, col: 1, row: 1 }),
      ).rejects.toBeInstanceOf(TokenNotFoundError);
      await expect(
        move.execute(master, { id, col: 1, row: 1 }),
      ).resolves.toMatchObject({ hidden: true });
    });

    it('reports the previous visibility when the master reveals one', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        hidden: true,
      });

      const change = await update.execute(master, { id, hidden: false });

      expect(change).toMatchObject({
        token: { hidden: false },
        wasHidden: true,
      });
      await expect(remove.execute(master, id)).resolves.toEqual({
        id,
        wasHidden: false,
      });
    });

    it('swaps and clears the icon', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        icon: 'wolf-head',
      });

      const swapped = await update.execute(master, { id, icon: 'raven' });
      const kept = await update.execute(master, { id, label: 'Corvo' });
      const cleared = await update.execute(master, { id, icon: null });

      expect(swapped.token.icon).toBe('raven');
      expect(kept.token.icon).toBe('raven');
      expect(cleared.token.icon).toBeNull();
    });
  });

  describe('hidden names', () => {
    it('hides the whole identity from players and keeps it for the master', async () => {
      await create.execute(master, {
        ...agentInput,
        label: 'Kian',
        kind: 'threat',
        icon: 'raven',
        sex: 'male',
        nameHidden: true,
      });

      const [forMaster] = await list.execute(master);
      const [forPlayer] = await list.execute(player);

      expect(forMaster).toMatchObject({
        label: 'Kian',
        kind: 'threat',
        icon: 'raven',
        sex: 'male',
        nameHidden: true,
      });
      expect(forPlayer).toMatchObject({
        label: '???',
        kind: 'npc',
        icon: null,
        sex: null,
        nameHidden: true,
      });
    });

    it('keeps the sex and the hidden name across edits until the master changes them', async () => {
      const { id } = await create.execute(master, {
        ...agentInput,
        sex: 'female',
        nameHidden: true,
      });

      const kept = await update.execute(master, { id, size: 2 });
      const revealed = await update.execute(master, {
        id,
        nameHidden: false,
        sex: null,
      });

      expect(kept.token).toMatchObject({ sex: 'female', nameHidden: true });
      expect(revealed.token).toMatchObject({ sex: null, nameHidden: false });
    });
  });

  describe('light in the fog', () => {
    it('lets the master keep a token dark across other edits', async () => {
      const { id } = await create.execute(master, agentInput);

      const dark = await update.execute(master, { id, emitsLight: false });
      const kept = await update.execute(master, { id, size: 2 });
      const [forPlayer] = await list.execute(player);

      expect(dark.token.emitsLight).toBe(false);
      expect(kept.token).toMatchObject({ emitsLight: false, size: 2 });
      expect(forPlayer.emitsLight).toBe(false);
    });

    it('does not let a player turn a light off', async () => {
      const { id } = await create.execute(master, agentInput);

      await expect(
        update.execute(player, { id, emitsLight: false }),
      ).rejects.toBeInstanceOf(TokenForbiddenError);
    });
  });
});
