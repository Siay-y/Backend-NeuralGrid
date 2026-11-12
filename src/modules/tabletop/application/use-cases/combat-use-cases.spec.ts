import { ChatHistoryRetention } from '../../../chat/application/services/chat-history-retention';
import { MessageAudienceValidator } from '../../../chat/application/services/message-audience-validator';
import { RollDiceUseCase } from '../../../chat/application/use-cases/roll-dice.use-case';
import { InMemoryChatMessageRepository } from '../../../chat/testing/in-memory-chat-message.repository';
import { ScriptedRandomSource } from '../../../chat/testing/scripted-random-source';
import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import { GetFogUseCase } from '../../../maps/application/use-cases/fog-use-cases';
import { InMemoryFogSettingsRepository } from '../../../maps/testing/in-memory-fog-settings.repository';
import { FindSheetUseCase } from '../../../sheets/application/use-cases/sheet-use-cases';
import { CharacterSheet } from '../../../sheets/domain/entities/character-sheet';
import { InMemorySheetRepository } from '../../../sheets/testing/in-memory-sheet.repository';
import { Token } from '../../domain/entities/token';
import type { TableActor } from '../../domain/policies/token-policy';
import { InMemoryCombatRepository } from '../../testing/in-memory-combat.repository';
import { InMemoryTokenRepository } from '../../testing/in-memory-token.repository';
import {
  CombatTracker,
  DropFromCombatUseCase,
  EditCombatantUseCase,
  EndCombatUseCase,
  GetCombatUseCase,
  JoinCombatUseCase,
  LeaveCombatUseCase,
  PassTurnUseCase,
  RollInitiativeUseCase,
  StartCombatUseCase,
  StepTurnUseCase,
} from './combat-use-cases';

const master: TableActor = { id: 'master-1', role: 'master' };
const player: TableActor = { id: 'player-1', role: 'player' };

function token(
  id: string,
  changes: Partial<{
    hidden: boolean;
    ownerId: string | null;
    emitsLight: boolean;
    sheetId: string | null;
  }> = {},
): Token {
  return Token.create({
    id,
    label: id,
    kind: 'npc',
    icon: null,
    sex: null,
    hidden: false,
    nameHidden: false,
    emitsLight: true,
    ownerId: null,
    sheetId: null,
    size: 1,
    col: 0,
    row: 0,
    now: new Date(),
    ...changes,
  });
}

async function setup() {
  const tokens = new InMemoryTokenRepository();
  const sheets = new InMemorySheetRepository();
  const fog = new InMemoryFogSettingsRepository();
  const tracker = new CombatTracker(new InMemoryCombatRepository(), tokens);
  const messages = new InMemoryChatMessageRepository();
  const rollDice = new RollDiceUseCase(
    messages,
    new MessageAudienceValidator(
      new GetUserByIdUseCase(new InMemoryUserRepository()),
    ),
    new ChatHistoryRetention(messages),
    new ScriptedRandomSource([12]),
  );
  await sheets.save(
    CharacterSheet.create({
      id: 'sheet-kael',
      ownerId: 'player-1',
      kind: 'agent',
      data: { identity: { name: 'Kael' }, attributes: { agility: 16 } },
      now: new Date(),
    }),
  );
  await tokens.save(
    token('kael', { ownerId: 'player-1', sheetId: 'sheet-kael' }),
  );
  await tokens.save(token('lich'));
  await tokens.save(token('spy', { hidden: true }));
  return {
    tokens,
    fog,
    get: new GetCombatUseCase(tracker),
    join: new JoinCombatUseCase(tracker, new GetFogUseCase(fog)),
    leave: new LeaveCombatUseCase(tracker),
    edit: new EditCombatantUseCase(tracker),
    roll: new RollInitiativeUseCase(
      tracker,
      new FindSheetUseCase(sheets),
      rollDice,
    ),
    start: new StartCombatUseCase(tracker),
    step: new StepTurnUseCase(tracker),
    pass: new PassTurnUseCase(tracker),
    end: new EndCombatUseCase(tracker),
    drop: new DropFromCombatUseCase(tracker),
  };
}

describe('combat use cases', () => {
  it('refuses a turn step that was asked for an older turn', async () => {
    const { join, edit, start, step, pass } = await setup();
    await join.execute(master, ['kael', 'lich']);
    await edit.execute(master, 'kael', { initiative: 20 });
    await start.execute(master);

    await Promise.all([
      pass.execute(player, 'kael'),
      step
        .execute(master, 1, { round: 1, turnId: 'kael' })
        .catch((error: unknown) => error),
    ]).then(([passed, stale]) => {
      expect(passed.master.turnId).toBe('lich');
      expect(stale).toMatchObject({ code: 'INVALID_COMBAT' });
    });
  });

  it('tells when a removed token was in the fight', async () => {
    const { tokens, join, drop } = await setup();
    await join.execute(master, ['kael']);
    await tokens.delete('lich');
    expect(await drop.execute(['lich'])).toBeNull();

    await tokens.delete('kael');
    expect((await drop.execute(['kael']))?.master.combatants).toEqual([]);
    expect(await drop.execute(['kael'])).toBeNull();
  });

  it('lets a player end only the turn of their own character', async () => {
    const { join, edit, start, pass } = await setup();
    await join.execute(master, ['kael', 'lich']);
    await edit.execute(master, 'kael', { initiative: 20 });
    await start.execute(master);

    await expect(pass.execute(player, 'lich')).rejects.toMatchObject({
      code: 'COMBAT_FORBIDDEN',
    });
    const passed = await pass.execute(player, 'kael');
    expect(passed.master.turnId).toBe('lich');
    await expect(pass.execute(player, 'kael')).rejects.toMatchObject({
      code: 'INVALID_COMBAT',
    });
  });

  it('lets only the master conduct the fight', async () => {
    const { join, start, step, end } = await setup();

    for (const attempt of [
      () => join.execute(player, ['kael']),
      () => start.execute(player),
      () => step.execute(player, 1),
      () => end.execute(player),
    ]) {
      await expect(attempt()).rejects.toMatchObject({
        code: 'COMBAT_FORBIDDEN',
      });
    }
  });

  it('rolls d20 plus the Agility modifier for tokens with a sheet only', async () => {
    const { join, roll, edit } = await setup();
    await join.execute(master, ['kael', 'lich']);

    const { views, messages } = await roll.execute(master, null);
    expect(views.master.combatants).toEqual([
      { tokenId: 'kael', initiative: 15, hidden: false },
      { tokenId: 'lich', initiative: null, hidden: false },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      visibility: 'public',
      roll: { label: 'Iniciativa · kael', total: 15 },
    });

    await edit.execute(master, 'kael', { hidden: true });
    await edit.execute(master, 'lich', { initiative: 20 });
    const again = await roll.execute(master, ['kael']);
    expect(again.messages[0].visibility).toBe('gm');
    expect(again.views.master.combatants.map(({ tokenId }) => tokenId)).toEqual(
      ['lich', 'kael'],
    );
  });

  it('keeps hidden tokens, and tokens without light in the fog, out of the players list', async () => {
    const { join, edit, fog, start } = await setup();
    await fog.save({ enabled: true, radius: 6, memory: false });

    const { master: all, players } = await join.execute(master, [
      'kael',
      'lich',
      'spy',
    ]);
    expect(all.combatants.map(({ hidden }) => hidden)).toEqual([
      false,
      true,
      true,
    ]);
    expect(players.combatants.map(({ tokenId }) => tokenId)).toEqual(['kael']);

    await edit.execute(master, 'kael', { initiative: 1 });
    await edit.execute(master, 'lich', { initiative: 30 });
    const started = await start.execute(master);
    expect(started.master.turnId).toBe('lich');
    expect(started.players.turnId).toBeNull();

    const revealed = await edit.execute(master, 'spy', { hidden: false });
    expect(revealed.players.combatants.map(({ tokenId }) => tokenId)).toEqual([
      'kael',
    ]);
  });

  it('drops tokens that left the table and clears everything at the end', async () => {
    const { tokens, join, leave, get, end } = await setup();
    await join.execute(master, ['kael', 'lich']);

    await tokens.delete('lich');
    expect((await get.execute()).master.combatants).toHaveLength(1);

    expect((await leave.execute(master, 'kael')).master).toEqual({
      round: 0,
      turnId: null,
      combatants: [],
    });

    await join.execute(master, ['kael']);
    expect((await end.execute(master)).players.combatants).toEqual([]);
  });
});
