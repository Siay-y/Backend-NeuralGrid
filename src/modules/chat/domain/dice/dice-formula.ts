import { InvalidDiceExpressionError } from '../errors/invalid-dice-expression.error';

export const DICE_LIMITS = {
  maxLength: 64,
  maxTerms: 12,
  maxDicePerTerm: 50,
  maxDiceTotal: 100,
  minSides: 2,
  maxSides: 100,
  maxFlat: 999,
} as const;

export type KeepMode = 'highest' | 'lowest';

export interface DiceKeep {
  mode: KeepMode;
  count: number;
}

export interface DiceTerm {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number;
  keep: DiceKeep | null;
}

export interface FlatTerm {
  kind: 'flat';
  sign: 1 | -1;
  value: number;
}

export type FormulaTerm = DiceTerm | FlatTerm;

export interface DiceFormula {
  notation: string;
  terms: readonly FormulaTerm[];
}

const SHAPE = /^[+-]?[^+-]+(?:[+-][^+-]+)*$/;
const TERM = /([+-]?)([^+-]+)/g;
const DICE_TERM = /^(\d{1,3})?d(\d{1,4})(?:(kh|kl)(\d{1,3})?)?$/;
const FLAT_TERM = /^\d{1,4}$/;

export function parseDiceFormula(raw: string): DiceFormula {
  const compact = raw.replace(/\s+/g, '').toLowerCase();
  if (compact.length === 0) {
    throw new InvalidDiceExpressionError(
      'Digite uma expressão de dados, como 1d20+5',
    );
  }
  if (compact.length > DICE_LIMITS.maxLength) {
    throw new InvalidDiceExpressionError(
      `A expressão pode ter no máximo ${DICE_LIMITS.maxLength} caracteres`,
    );
  }
  if (!SHAPE.test(compact)) {
    throw new InvalidDiceExpressionError(
      'Use termos separados por + ou -, como 2d6+3',
    );
  }

  const terms: FormulaTerm[] = [];
  for (const [, signText, body] of compact.matchAll(TERM)) {
    const sign = signText === '-' ? -1 : 1;
    terms.push(parseTerm(body, sign));
  }

  if (terms.length > DICE_LIMITS.maxTerms) {
    throw new InvalidDiceExpressionError(
      `Use no máximo ${DICE_LIMITS.maxTerms} termos`,
    );
  }

  const dice = terms.filter((term): term is DiceTerm => term.kind === 'dice');
  if (dice.length === 0) {
    throw new InvalidDiceExpressionError(
      'A expressão precisa ter pelo menos um dado',
    );
  }
  const totalDice = dice.reduce((sum, term) => sum + term.count, 0);
  if (totalDice > DICE_LIMITS.maxDiceTotal) {
    throw new InvalidDiceExpressionError(
      `Uma rolagem pode ter no máximo ${DICE_LIMITS.maxDiceTotal} dados`,
    );
  }

  return { notation: formatFormula(terms), terms };
}

function parseTerm(body: string, sign: 1 | -1): FormulaTerm {
  if (FLAT_TERM.test(body)) {
    const value = Number(body);
    if (value > DICE_LIMITS.maxFlat) {
      throw new InvalidDiceExpressionError(
        `Modificadores vão até ${DICE_LIMITS.maxFlat}`,
      );
    }
    return { kind: 'flat', sign, value };
  }

  const match = DICE_TERM.exec(body);
  if (!match) {
    throw new InvalidDiceExpressionError(
      `Não entendi "${body}". Use termos como 2d6, 3d20kh1 ou 5`,
    );
  }

  const [, countText, sidesText, keepText, keepCountText] = match;
  const count = countText === undefined ? 1 : Number(countText);
  const sides = Number(sidesText);

  if (count < 1 || count > DICE_LIMITS.maxDicePerTerm) {
    throw new InvalidDiceExpressionError(
      `Cada termo rola de 1 a ${DICE_LIMITS.maxDicePerTerm} dados`,
    );
  }
  if (sides < DICE_LIMITS.minSides || sides > DICE_LIMITS.maxSides) {
    throw new InvalidDiceExpressionError(
      `Os dados precisam ter entre ${DICE_LIMITS.minSides} e ${DICE_LIMITS.maxSides} faces`,
    );
  }

  let keep: DiceKeep | null = null;
  if (keepText) {
    const keepCount = keepCountText === undefined ? 1 : Number(keepCountText);
    if (keepCount < 1 || keepCount > count) {
      throw new InvalidDiceExpressionError(
        `Em ${body}, mantenha entre 1 e ${count} dados`,
      );
    }
    keep = { mode: keepText === 'kh' ? 'highest' : 'lowest', count: keepCount };
  }

  return { kind: 'dice', sign, count, sides, keep };
}

export function formatTerm(term: FormulaTerm): string {
  if (term.kind === 'flat') {
    return String(term.value);
  }
  const keep = term.keep
    ? `${term.keep.mode === 'highest' ? 'kh' : 'kl'}${term.keep.count}`
    : '';
  return `${term.count}d${term.sides}${keep}`;
}

function formatFormula(terms: readonly FormulaTerm[]): string {
  return terms
    .map((term, index) => {
      const sign = term.sign === -1 ? '-' : index === 0 ? '' : '+';
      return `${sign}${formatTerm(term)}`;
    })
    .join('');
}
