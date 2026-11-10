import { InvalidDiceExpressionError } from '../errors/invalid-dice-expression.error';
import { parseDiceFormula } from './dice-formula';
import { type DiceTermResult, rollDiceFormula } from './dice-roll';

function scripted(values: number[]) {
  let cursor = 0;
  return (min: number, max: number) => {
    const value = values[cursor++];
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
    return value;
  };
}

describe('parseDiceFormula', () => {
  it('normalizes spacing, case and implicit counts', () => {
    expect(parseDiceFormula(' D20 + 5 ').notation).toBe('1d20+5');
    expect(parseDiceFormula('3D20KH').notation).toBe('3d20kh1');
    expect(parseDiceFormula('2d20kl1-1d4+3').notation).toBe('2d20kl1-1d4+3');
  });

  it('reads signs and keep rules into terms', () => {
    const { terms } = parseDiceFormula('-1d6+4d8kh2-3');

    expect(terms).toEqual([
      { kind: 'dice', sign: -1, count: 1, sides: 6, keep: null },
      {
        kind: 'dice',
        sign: 1,
        count: 4,
        sides: 8,
        keep: { mode: 'highest', count: 2 },
      },
      { kind: 'flat', sign: -1, value: 3 },
    ]);
  });

  it.each([
    ['', 'Digite uma expressão'],
    ['5', 'pelo menos um dado'],
    ['1d20++5', 'separados por'],
    ['1d20+', 'separados por'],
    ['abc', 'Não entendi'],
    ['1d1', 'entre 2 e 100 faces'],
    ['1d101', 'entre 2 e 100 faces'],
    ['0d6', 'de 1 a 50 dados'],
    ['51d6', 'de 1 a 50 dados'],
    ['2d20kh3', 'mantenha entre 1 e 2'],
    ['2d20kh0', 'mantenha entre 1 e 2'],
    ['50d6+50d6+1d6', 'no máximo 100 dados'],
    ['1d6+1000', 'até 999'],
    [`1d6${'+1'.repeat(12)}`, 'no máximo 12 termos'],
    [`1d6${'+1'.repeat(31)}`, 'no máximo 64'],
  ])('rejects %j', (expression, reason) => {
    expect(() => parseDiceFormula(expression)).toThrow(
      InvalidDiceExpressionError,
    );
    expect(() => parseDiceFormula(expression)).toThrow(reason);
  });
});

describe('rollDiceFormula', () => {
  it('sums every die and modifier with its sign', () => {
    const roll = rollDiceFormula(
      parseDiceFormula('2d6-1d4+3'),
      scripted([5, 2, 4]),
    );

    expect(roll.total).toBe(5 + 2 - 4 + 3);
    expect(roll.notation).toBe('2d6-1d4+3');
  });

  it('keeps the highest d20 for an attribute test', () => {
    const roll = rollDiceFormula(
      parseDiceFormula('3d20kh1+5'),
      scripted([7, 18, 18]),
    );
    const d20 = roll.terms[0] as DiceTermResult;

    expect(d20.rolls).toEqual([
      { value: 7, kept: false },
      { value: 18, kept: true },
      { value: 18, kept: false },
    ]);
    expect(roll.total).toBe(23);
  });

  it('keeps the lowest d20 when the attribute is zero', () => {
    const roll = rollDiceFormula(
      parseDiceFormula('2d20kl1'),
      scripted([15, 4]),
    );

    expect((roll.terms[0] as DiceTermResult).rolls).toEqual([
      { value: 15, kept: false },
      { value: 4, kept: true },
    ]);
    expect(roll.total).toBe(4);
  });

  it('keeps several dice when asked', () => {
    const roll = rollDiceFormula(
      parseDiceFormula('4d6kh3'),
      scripted([1, 6, 3, 5]),
    );

    expect(roll.total).toBe(14);
  });
});
