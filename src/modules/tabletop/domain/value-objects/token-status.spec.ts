import { shiftHitPoints } from '../../../sheets/domain/value-objects/sheet-data';
import { InvalidStatusError } from '../errors/invalid-status.error';
import {
  applyStatus,
  passTurn,
  removeStatus,
  ticksEachTurn,
  tokenStatus,
  type TokenStatus,
} from './token-status';

function status(changes: Partial<TokenStatus> & Pick<TokenStatus, 'kind'>) {
  return tokenStatus({ turns: null, amount: null, immuneTo: [], ...changes });
}

describe('token status', () => {
  it('keeps a single effect of each kind and refreshes it when applied again', () => {
    const first = applyStatus(
      [],
      status({ kind: 'poison', amount: '1d6', turns: 3 }),
    );
    const again = applyStatus(
      first,
      status({ kind: 'poison', amount: '2d4', turns: 2 }),
    );

    expect(again).toEqual([
      { kind: 'poison', turns: 2, amount: '2d4', immuneTo: [] },
    ]);
  });

  it('lists debuffs before buffs in the catalog order', () => {
    const statuses = [
      status({ kind: 'haste' }),
      status({ kind: 'blind' }),
    ].reduce(applyStatus, [] as TokenStatus[]);

    expect(statuses.map(({ kind }) => kind)).toEqual(['blind', 'haste']);
  });

  it('refuses a debuff the token is immune to and clears covered debuffs on immunity', () => {
    const poisoned = applyStatus([], status({ kind: 'poison', amount: '1d6' }));
    const immune = applyStatus(
      poisoned,
      status({ kind: 'immune', immuneTo: ['poison', 'confused'] }),
    );

    expect(immune.map(({ kind }) => kind)).toEqual(['immune']);
    expect(() => applyStatus(immune, status({ kind: 'confused' }))).toThrow(
      'Esse personagem está imune a Confuso',
    );
    expect(
      applyStatus(immune, status({ kind: 'blind' })).map(({ kind }) => kind),
    ).toEqual(['blind', 'immune']);
  });

  it('validates duration, value and immunity choices', () => {
    expect(() => status({ kind: 'slow', turns: 0 })).toThrow(
      InvalidStatusError,
    );
    expect(() => status({ kind: 'slow', turns: 100 })).toThrow(
      InvalidStatusError,
    );
    expect(() => status({ kind: 'blind', amount: '1d6' })).toThrow(
      'Cego não usa valor',
    );
    expect(() => status({ kind: 'immune' })).toThrow(
      'Escolha ao menos um efeito para a imunidade',
    );
    expect(status({ kind: 'haste', immuneTo: ['poison'] }).immuneTo).toEqual(
      [],
    );
    expect(status({ kind: 'bleeding', amount: '  ' }).amount).toBeNull();
  });

  it('only rolls damage and healing every turn', () => {
    expect(ticksEachTurn(status({ kind: 'burning', amount: '1d4' }))).toBe(
      true,
    );
    expect(ticksEachTurn(status({ kind: 'regeneration', amount: '2' }))).toBe(
      true,
    );
    expect(ticksEachTurn(status({ kind: 'iron-skin', amount: '2' }))).toBe(
      false,
    );
    expect(ticksEachTurn(status({ kind: 'bleeding' }))).toBe(false);
  });

  it('counts the turns down and drops the effects that end', () => {
    const statuses = [
      status({ kind: 'poison', turns: 1, amount: '1d6' }),
      status({ kind: 'slow', turns: 2 }),
      status({ kind: 'giant' }),
    ];

    expect(passTurn(statuses)).toEqual([
      { kind: 'slow', turns: 1, amount: null, immuneTo: [] },
      { kind: 'giant', turns: null, amount: null, immuneTo: [] },
    ]);
  });

  it('removes an effect and refuses one the token does not have', () => {
    const statuses = [status({ kind: 'death', turns: 3 })];

    expect(removeStatus(statuses, 'death')).toEqual([]);
    expect(() => removeStatus(statuses, 'blind')).toThrow(
      'Esse personagem não está com Cego',
    );
  });

  it('lets damage go below zero and keeps healing under the maximum', () => {
    expect(shiftHitPoints({ current: 5, max: 20 }, -8)).toBe(-3);
    expect(shiftHitPoints({ current: -9990, max: 20 }, -30)).toBe(-9999);
    expect(shiftHitPoints({ current: 18, max: 20 }, 5)).toBe(20);
    expect(shiftHitPoints({ current: 25, max: 20 }, 5)).toBe(25);
  });
});
