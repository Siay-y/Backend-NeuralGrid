import {
  type Combat,
  COMBAT_LIMITS,
  editCombatant,
  IDLE_COMBAT,
  joinCombat,
  leaveCombat,
  clampInitiative,
  initiativeExpression,
  startCombat,
  stepTurn,
  turnOrder,
} from './combat';

const entry = (tokenId: string, initiative: number | null = null) => ({
  tokenId,
  initiative,
  hidden: false,
});

function fight(...initiatives: [string, number | null][]): Combat {
  return joinCombat(
    IDLE_COMBAT,
    initiatives.map(([id, value]) => entry(id, value)),
  );
}

const ids = (combat: Combat) =>
  turnOrder(combat.combatants).map(({ tokenId }) => tokenId);

describe('combat', () => {
  it('orders by initiative, keeps ties in joining order and leaves the unrolled last', () => {
    const combat = fight(['a', 12], ['b', null], ['c', 18], ['d', 12]);

    expect(ids(combat)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('adds each token once and keeps the participant limit', () => {
    const combat = joinCombat(fight(['a', 5]), [entry('a'), entry('b')]);
    expect(ids(combat)).toEqual(['a', 'b']);

    const crowd = Array.from({ length: COMBAT_LIMITS.combatants }, (_, index) =>
      entry(`t${index}`),
    );
    expect(() => joinCombat(combat, crowd)).toThrow('até 40');
  });

  it('accepts only whole initiatives in range for tokens in the fight', () => {
    const combat = fight(['a', null]);

    expect(
      editCombatant(combat, 'a', { initiative: 7 }).combatants[0],
    ).toMatchObject({ initiative: 7 });
    expect(() => editCombatant(combat, 'a', { initiative: 2.5 })).toThrow();
    expect(() => editCombatant(combat, 'a', { initiative: 1000 })).toThrow();
    expect(() => editCombatant(combat, 'x', { hidden: true })).toThrow(
      'não está no combate',
    );
  });

  it('starts with the highest initiative and counts a round after the last turn', () => {
    expect(() => startCombat(IDLE_COMBAT)).toThrow();

    let combat = startCombat(fight(['a', 10], ['b', 20]));
    expect(combat).toMatchObject({ round: 1, turnId: 'b' });

    combat = stepTurn(combat, 1);
    expect(combat).toMatchObject({ round: 1, turnId: 'a' });

    combat = stepTurn(combat, 1);
    expect(combat).toMatchObject({ round: 2, turnId: 'b' });

    combat = stepTurn(combat, -1);
    expect(combat).toMatchObject({ round: 1, turnId: 'a' });
  });

  it('does not go back before the first turn nor step before the start', () => {
    const combat = startCombat(fight(['a', 10], ['b', 20]));

    expect(stepTurn(combat, -1)).toEqual(combat);
    expect(() => stepTurn(fight(['a', 1]), 1)).toThrow('não começou');
  });

  it('passes the turn on when the one acting leaves, and ends when nobody is left', () => {
    let combat = stepTurn(
      startCombat(fight(['a', 30], ['b', 20], ['c', 10])),
      1,
    );
    expect(combat.turnId).toBe('b');

    combat = leaveCombat(combat, ['b']);
    expect(combat).toMatchObject({ round: 1, turnId: 'c' });

    combat = leaveCombat(combat, ['c']);
    expect(combat).toMatchObject({ round: 2, turnId: 'a' });

    expect(leaveCombat(combat, ['a'])).toEqual(IDLE_COMBAT);
  });

  it('writes the roll as d20 plus the modifier and keeps the result in range', () => {
    expect(initiativeExpression(3)).toBe('1d20+3');
    expect(initiativeExpression(-2)).toBe('1d20-2');
    expect(initiativeExpression(0)).toBe('1d20');
    expect(clampInitiative(1200)).toBe(999);
  });
});
