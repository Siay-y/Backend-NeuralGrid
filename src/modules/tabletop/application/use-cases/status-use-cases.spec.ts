import { ChatHistoryRetention } from '../../../chat/application/services/chat-history-retention';
import { MessageAudienceValidator } from '../../../chat/application/services/message-audience-validator';
import { RollDiceUseCase } from '../../../chat/application/use-cases/roll-dice.use-case';
import { InMemoryChatMessageRepository } from '../../../chat/testing/in-memory-chat-message.repository';
import { ScriptedRandomSource } from '../../../chat/testing/scripted-random-source';
import {
  AdjustHitPointsUseCase,
  FindSheetUseCase,
} from '../../../sheets/application/use-cases/sheet-use-cases';
import { CharacterSheet } from '../../../sheets/domain/entities/character-sheet';
import { InMemorySheetRepository } from '../../../sheets/testing/in-memory-sheet.repository';
import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import { Token } from '../../domain/entities/token';
import type { TableActor } from '../../domain/policies/token-policy';
import type { StatusKind } from '../../domain/value-objects/token-status';
import { InMemoryTokenRepository } from '../../testing/in-memory-token.repository';
import { InMemoryTokenStatusRepository } from '../../testing/in-memory-token-status.repository';
import {
  ApplyStatusUseCase,
  ListStatusesUseCase,
  RemoveStatusUseCase,
  StatusBook,
} from './status-use-cases';
import { DeathWatch } from './death-use-cases';
import { TickStatusesUseCase } from './tick-statuses.use-case';

const master: TableActor = { id: 'master-1', role: 'master' };
const player: TableActor = { id: 'player-1', role: 'player' };

function token(
  id: string,
  changes: Partial<{
    kind: 'agent' | 'npc' | 'threat';
    hidden: boolean;
    nameHidden: boolean;
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

async function setup(rolls: number[] = [4]) {
  const tokens = new InMemoryTokenRepository();
  const sheets = new InMemorySheetRepository();
  const messages = new InMemoryChatMessageRepository();
  const book = new StatusBook(new InMemoryTokenStatusRepository(), tokens);
  const rollDice = new RollDiceUseCase(
    messages,
    new MessageAudienceValidator(
      new GetUserByIdUseCase(new InMemoryUserRepository()),
    ),
    new ChatHistoryRetention(messages),
    new ScriptedRandomSource(rolls),
  );
  await sheets.save(
    CharacterSheet.create({
      id: 'sheet-kael',
      ownerId: 'player-1',
      kind: 'agent',
      data: {
        identity: { name: 'Kael' },
        status: { hp: { current: 10, max: 12 } },
      },
      now: new Date(),
    }),
  );
  await tokens.save(token('kael', { sheetId: 'sheet-kael' }));
  await tokens.save(token('lich', { nameHidden: true }));
  await tokens.save(token('spy', { hidden: true }));
  const findSheet = new FindSheetUseCase(sheets);
  const adjust = new AdjustHitPointsUseCase(sheets);
  const deaths = new DeathWatch(book, tokens, findSheet, adjust, rollDice);
  const setHp = async (current: number) => {
    const sheet = await sheets.findById('sheet-kael');
    const status = sheet!.data.status;
    await sheets.save(
      sheet!.edit(
        { data: { status: { ...status, hp: { ...status.hp, current } } } },
        new Date(),
      ),
    );
    return (await findSheet.execute('sheet-kael'))!;
  };
  return {
    sheets,
    tokens,
    deaths,
    setHp,
    list: new ListStatusesUseCase(book),
    apply: new ApplyStatusUseCase(book),
    remove: new RemoveStatusUseCase(book),
    tick: new TickStatusesUseCase(book, rollDice, adjust, deaths),
  };
}

function effect(
  tokenId: string,
  kind: StatusKind,
  changes: Partial<{ turns: number | null; amount: string | null }> = {},
) {
  return {
    tokenId,
    kind,
    turns: null,
    amount: null,
    immuneTo: [],
    ...changes,
  };
}

describe('status use cases', () => {
  it('lets only the master apply and remove effects', async () => {
    const { apply, remove } = await setup();

    await expect(
      apply.execute(player, effect('kael', 'poison')),
    ).rejects.toMatchObject({ code: 'STATUS_FORBIDDEN' });
    await apply.execute(master, effect('kael', 'slow'));
    await expect(remove.execute(player, 'kael', 'slow')).rejects.toMatchObject({
      code: 'STATUS_FORBIDDEN',
    });
    await expect(remove.execute(master, 'kael', 'slow')).resolves.toEqual({
      tokenId: 'kael',
      statuses: [],
      hidden: false,
    });
  });

  it('refuses a value that is not a dice expression and a missing token', async () => {
    const { apply } = await setup();

    await expect(
      apply.execute(master, effect('kael', 'poison', { amount: 'muito' })),
    ).rejects.toMatchObject({ code: 'INVALID_DICE' });
    await expect(
      apply.execute(master, effect('kael', 'bleeding', { amount: '3' })),
    ).rejects.toMatchObject({ code: 'INVALID_DICE' });
    await expect(
      apply.execute(master, effect('kael', 'iron-skin', { amount: '3' })),
    ).resolves.toMatchObject({
      statuses: [{ kind: 'iron-skin', amount: '3' }],
    });
    await expect(
      apply.execute(master, effect('ghost', 'slow')),
    ).rejects.toMatchObject({ code: 'TOKEN_NOT_FOUND' });
  });

  it('keeps the effects of hidden tokens away from players', async () => {
    const { apply, list } = await setup();
    await apply.execute(master, effect('kael', 'haste'));
    await apply.execute(master, effect('spy', 'invisible'));

    expect((await list.execute(master)).map(({ tokenId }) => tokenId)).toEqual([
      'kael',
      'spy',
    ]);
    expect(await list.execute(player)).toEqual([
      {
        tokenId: 'kael',
        statuses: [{ kind: 'haste', turns: null, amount: null, immuneTo: [] }],
      },
    ]);
  });

  it('rolls damage and healing at the start of the turn and applies it to the sheet', async () => {
    const { apply, tick, sheets } = await setup([4, 3]);
    await apply.execute(
      master,
      effect('kael', 'poison', { amount: '1d6', turns: 2 }),
    );
    await apply.execute(
      master,
      effect('kael', 'regeneration', { amount: '1d4' }),
    );

    const result = await tick.execute(master, {
      round: 1,
      tokenId: 'kael',
      secret: false,
    });

    expect(
      result?.messages.map(({ roll, visibility }) => [
        roll?.label,
        roll?.total,
        visibility,
      ]),
    ).toEqual([
      ['Veneno · kael', 4, 'public'],
      ['Regeneração · kael', 3, 'public'],
    ]);
    expect(result?.changes[0].statuses).toEqual([
      { kind: 'poison', turns: 1, amount: '1d6', immuneTo: [] },
      { kind: 'regeneration', turns: null, amount: '1d4', immuneTo: [] },
    ]);
    expect(result?.sheets[0]?.sheet.data.status.hp).toEqual({
      current: 9,
      max: 12,
    });
    expect((await sheets.findById('sheet-kael'))?.data.status.hp.current).toBe(
      9,
    );
  });

  it('rolls each turn once per round, even after stepping back', async () => {
    const { apply, tick } = await setup([5]);
    await apply.execute(
      master,
      effect('kael', 'bleeding', { amount: '1d6', turns: 3 }),
    );
    const turn = { round: 2, tokenId: 'kael', secret: false };

    expect(await tick.execute(master, turn)).not.toBeNull();
    expect(await tick.execute(master, turn)).toBeNull();
    tick.restart();
    expect(
      (await tick.execute(master, turn))?.changes[0].statuses[0].turns,
    ).toBe(1);
  });

  it('rolls secretly for a hidden combatant and masks a hidden name', async () => {
    const { apply, tick } = await setup([2]);
    await apply.execute(master, effect('lich', 'burning', { amount: '1d4' }));
    await apply.execute(master, effect('spy', 'burning', { amount: '1d4' }));

    const masked = await tick.execute(master, {
      round: 1,
      tokenId: 'lich',
      secret: false,
    });
    const secret = await tick.execute(master, {
      round: 1,
      tokenId: 'spy',
      secret: false,
    });

    expect(masked?.messages[0]).toMatchObject({
      visibility: 'public',
      roll: { label: 'Queimação · ???' },
    });
    expect(masked?.sheets).toEqual([]);
    expect(secret?.messages[0]).toMatchObject({
      visibility: 'gm',
      roll: { label: 'Queimação · spy' },
    });
    expect(secret?.changes[0].hidden).toBe(true);
  });

  it('skips the turn of a token without effects', async () => {
    const { tick } = await setup();

    await expect(
      tick.execute(master, { round: 1, tokenId: 'kael', secret: false }),
    ).resolves.toBeNull();
  });
});

describe('death', () => {
  const turn = (round: number) => ({ round, tokenId: 'kael', secret: false });

  it('falls below minus Resistência plus its Mod and stops the player from acting', async () => {
    const { deaths, setHp } = await setup();

    expect((await deaths.review(await setHp(-10))).events).toEqual([]);
    const fell = await deaths.review(await setHp(-11));

    expect(fell.events).toMatchObject([
      { kind: 'fell', tokenId: 'kael', attemptsLeft: 3 },
    ]);
    expect(fell.changes[0].statuses).toEqual([
      { kind: 'death', turns: 3, amount: null, immuneTo: [] },
    ]);
    await expect(deaths.assertCanAct(player, 'kael')).rejects.toMatchObject({
      code: 'CHARACTER_DEAD',
    });
    await expect(
      deaths.assertSheetAlive(player, 'sheet-kael'),
    ).rejects.toMatchObject({ code: 'CHARACTER_DEAD' });
    await expect(deaths.assertCanAct(master, 'kael')).resolves.toBeUndefined();
  });

  it('gives agents death saves too', async () => {
    const { deaths, setHp, tokens } = await setup();
    await tokens.save(token('kael', { sheetId: 'sheet-kael', kind: 'agent' }));

    expect((await deaths.review(await setHp(-11))).events).toMatchObject([
      { kind: 'fell', tokenId: 'kael', attemptsLeft: 3 },
    ]);
  });

  it('kills threats at once, without death saves', async () => {
    const { apply, deaths, setHp, tokens, tick } = await setup([20]);
    await tokens.save(token('kael', { sheetId: 'sheet-kael', kind: 'threat' }));
    await tokens.save(token('ogre', { kind: 'threat' }));

    const dead = await deaths.review(await setHp(-11));

    expect(dead.events).toMatchObject([
      { kind: 'killed', tokenId: 'kael', attemptsLeft: 0 },
    ]);
    expect(dead.changes[0].statuses).toEqual([
      { kind: 'death', turns: null, amount: null, immuneTo: [] },
    ]);
    expect((await tick.execute(master, turn(1)))?.messages).toEqual([]);
    expect((await deaths.review(await setHp(5))).events).toEqual([]);
    const ogre = await apply.execute(master, {
      ...effect('ogre', 'death'),
      turns: 3,
    });
    expect(ogre.statuses[0].turns).toBeNull();
  });

  it('dies for good after three failed death saves', async () => {
    const { deaths, setHp, tick } = await setup([14, 9, 3]);
    await deaths.review(await setHp(-20));

    const saves = [];
    for (const round of [1, 2, 3]) {
      saves.push(await tick.execute(master, turn(round)));
    }

    expect(
      saves.map((save) => [
        save?.events[0].roll,
        save?.events[0].success,
        save?.events[0].attemptsLeft,
      ]),
    ).toEqual([
      [14, false, 2],
      [9, false, 1],
      [3, false, 0],
    ]);
    expect(saves[0]?.messages[0].roll?.label).toBe('Teste de morte · kael');
    expect(saves[2]?.changes.at(-1)?.statuses).toEqual([
      { kind: 'death', turns: null, amount: null, immuneTo: [] },
    ]);
    const after = await tick.execute(master, turn(4));
    expect(after?.messages).toEqual([]);
    expect(after?.incapacitated).toBe(true);
  });

  it('wakes up with 1 HP on 15 or more', async () => {
    const { deaths, setHp, tick, sheets } = await setup([15]);
    await deaths.review(await setHp(-20));

    const save = await tick.execute(master, turn(1));

    expect(save?.events[0]).toMatchObject({ kind: 'save', success: true });
    expect(save?.incapacitated).toBe(false);
    expect((await sheets.findById('sheet-kael'))?.data.status.hp.current).toBe(
      1,
    );
  });

  it('stops the death saves once the HP is positive again', async () => {
    const { deaths, setHp } = await setup();
    await deaths.review(await setHp(-20));

    const healed = await deaths.review(await setHp(3));

    expect(healed.events).toMatchObject([{ kind: 'revived' }]);
    expect(healed.changes[0].statuses).toEqual([]);
  });

  it('lets only the master kill and bring someone back', async () => {
    const { apply, deaths, setHp, sheets } = await setup();
    await setHp(-30);
    const killed = await apply.execute(master, effect('kael', 'death'));
    expect((await deaths.announce(killed)).events).toMatchObject([
      { kind: 'killed', attemptsLeft: 0 },
    ]);

    await expect(deaths.revive(player, 'kael')).rejects.toMatchObject({
      code: 'STATUS_FORBIDDEN',
    });
    const back = await deaths.reviveSheet(master, 'sheet-kael');

    expect(back.events).toMatchObject([{ kind: 'revived', tokenId: 'kael' }]);
    expect((await sheets.findById('sheet-kael'))?.data.status.hp.current).toBe(
      1,
    );
    await expect(
      deaths.reviveSheet(master, 'sheet-kael'),
    ).rejects.toMatchObject({ code: 'INVALID_STATUS' });
  });

  it('never falls while immune to death', async () => {
    const { apply, deaths, setHp } = await setup();
    await apply.execute(master, {
      ...effect('kael', 'immune'),
      immuneTo: ['death'],
    });

    expect((await deaths.review(await setHp(-50))).events).toEqual([]);
  });
});
