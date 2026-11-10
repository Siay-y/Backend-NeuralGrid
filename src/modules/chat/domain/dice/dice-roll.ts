import type { DiceFormula, DiceTerm, FlatTerm, KeepMode } from './dice-formula';

export type RandomInt = (min: number, max: number) => number;

export interface RolledDie {
  value: number;
  kept: boolean;
}

export interface DiceTermResult extends DiceTerm {
  rolls: RolledDie[];
  subtotal: number;
}

export interface FlatTermResult extends FlatTerm {
  subtotal: number;
}

export type TermResult = DiceTermResult | FlatTermResult;

export interface DiceRoll {
  notation: string;
  terms: TermResult[];
  total: number;
}

export function rollDiceFormula(
  formula: DiceFormula,
  randomInt: RandomInt,
): DiceRoll {
  const terms = formula.terms.map((term): TermResult => {
    if (term.kind === 'flat') {
      return { ...term, subtotal: term.value };
    }
    const values = Array.from({ length: term.count }, () =>
      randomInt(1, term.sides),
    );
    const kept = term.keep
      ? keptIndexes(values, term.keep.mode, term.keep.count)
      : new Set(values.keys());
    const rolls = values.map((value, index) => ({
      value,
      kept: kept.has(index),
    }));
    const subtotal = rolls
      .filter((die) => die.kept)
      .reduce((sum, die) => sum + die.value, 0);
    return {
      ...term,
      keep: term.keep ? { ...term.keep } : null,
      rolls,
      subtotal,
    };
  });

  const total = terms.reduce((sum, term) => sum + term.sign * term.subtotal, 0);
  return { notation: formula.notation, terms, total };
}

function keptIndexes(
  values: number[],
  mode: KeepMode,
  count: number,
): Set<number> {
  const direction = mode === 'highest' ? -1 : 1;
  const ordered = [...values.keys()].sort(
    (a, b) => direction * (values[a] - values[b]) || a - b,
  );
  return new Set(ordered.slice(0, count));
}
