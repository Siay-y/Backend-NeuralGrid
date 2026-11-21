import { InvalidStatusError } from '../errors/invalid-status.error';
import type { TokenKind } from './token-kind';

export const DEBUFF_KINDS = [
  'bleeding',
  'poison',
  'slow',
  'mind-control',
  'blind',
  'burning',
  'confused',
  'death',
] as const;

export const BUFF_KINDS = [
  'giant',
  'invisible',
  'immune',
  'haste',
  'damage-reduction',
  'iron-skin',
  'regeneration',
] as const;

export const STATUS_KINDS = [...DEBUFF_KINDS, ...BUFF_KINDS] as const;

export type DebuffKind = (typeof DEBUFF_KINDS)[number];
export type StatusKind = (typeof STATUS_KINDS)[number];
export type StatusAmount = 'damage' | 'heal' | 'value';

export const STATUS_LIMITS = { turns: 99, amount: 64 } as const;

export const DEATH_SAVES = 3;
export const DEATH_SAVE_TARGET = 15;

export const STATUS_LABEL: Record<StatusKind, string> = {
  bleeding: 'Sangramento',
  poison: 'Veneno',
  slow: 'Lentidão',
  'mind-control': 'Controle mental',
  blind: 'Cego',
  burning: 'Queimação',
  confused: 'Confuso',
  death: 'Morte',
  giant: 'Gigantificação',
  invisible: 'Invisibilidade',
  immune: 'Imunidade',
  haste: 'Haste',
  'damage-reduction': 'Redução de dano',
  'iron-skin': 'Pele de ferro',
  regeneration: 'Regeneração',
};

export const STATUS_AMOUNT: Partial<Record<StatusKind, StatusAmount>> = {
  bleeding: 'damage',
  poison: 'damage',
  burning: 'damage',
  regeneration: 'heal',
  'damage-reduction': 'value',
  'iron-skin': 'value',
};

export interface TokenStatus {
  kind: StatusKind;
  turns: number | null;
  amount: string | null;
  immuneTo: DebuffKind[];
}

export function isStatusKind(value: unknown): value is StatusKind {
  return (STATUS_KINDS as readonly unknown[]).includes(value);
}

export function isDebuff(kind: StatusKind): kind is DebuffKind {
  return (DEBUFF_KINDS as readonly string[]).includes(kind);
}

export function ticksEachTurn(status: TokenStatus): boolean {
  const amount = STATUS_AMOUNT[status.kind];
  return status.amount !== null && (amount === 'damage' || amount === 'heal');
}

function assertTurns(turns: number | null): number | null {
  if (
    turns !== null &&
    (!Number.isInteger(turns) || turns < 1 || turns > STATUS_LIMITS.turns)
  ) {
    throw new InvalidStatusError(
      `A duração precisa ser de 1 a ${STATUS_LIMITS.turns} turnos`,
    );
  }
  return turns;
}

function assertAmount(kind: StatusKind, amount: string | null): string | null {
  const trimmed = amount?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }
  if (!STATUS_AMOUNT[kind]) {
    throw new InvalidStatusError(`${STATUS_LABEL[kind]} não usa valor`);
  }
  if (trimmed.length > STATUS_LIMITS.amount) {
    throw new InvalidStatusError(
      `O valor pode ter no máximo ${STATUS_LIMITS.amount} caracteres`,
    );
  }
  return trimmed;
}

function assertImmunity(
  kind: StatusKind,
  immuneTo: readonly string[],
): DebuffKind[] {
  if (kind !== 'immune') {
    return [];
  }
  const kinds = DEBUFF_KINDS.filter((debuff) => immuneTo.includes(debuff));
  if (kinds.length === 0) {
    throw new InvalidStatusError('Escolha ao menos um efeito para a imunidade');
  }
  return kinds;
}

export function tokenStatus(input: {
  kind: StatusKind;
  turns: number | null;
  amount: string | null;
  immuneTo: readonly string[];
}): TokenStatus {
  return {
    kind: input.kind,
    turns: assertTurns(input.turns),
    amount: assertAmount(input.kind, input.amount),
    immuneTo: assertImmunity(input.kind, input.immuneTo),
  };
}

export function sortStatuses(statuses: readonly TokenStatus[]): TokenStatus[] {
  return [...statuses].sort(
    (a, b) => STATUS_KINDS.indexOf(a.kind) - STATUS_KINDS.indexOf(b.kind),
  );
}

export function applyStatus(
  current: readonly TokenStatus[],
  status: TokenStatus,
): TokenStatus[] {
  const immunity = current.find(({ kind }) => kind === 'immune');
  if (
    isDebuff(status.kind) &&
    immunity?.immuneTo.includes(status.kind) === true
  ) {
    throw new InvalidStatusError(
      `Esse personagem está imune a ${STATUS_LABEL[status.kind]}`,
    );
  }
  const kept = current.filter(
    ({ kind }) =>
      kind !== status.kind &&
      !(isDebuff(kind) && status.immuneTo.includes(kind)),
  );
  return sortStatuses([...kept, status]);
}

export function removeStatus(
  current: readonly TokenStatus[],
  kind: StatusKind,
): TokenStatus[] {
  if (!current.some((status) => status.kind === kind)) {
    throw new InvalidStatusError(
      `Esse personagem não está com ${STATUS_LABEL[kind]}`,
    );
  }
  return current.filter((status) => status.kind !== kind);
}

export function passTurn(current: readonly TokenStatus[]): TokenStatus[] {
  return current
    .map((status) =>
      status.turns === null || status.kind === 'death'
        ? status
        : { ...status, turns: status.turns - 1 },
    )
    .filter((status) => status.turns === null || status.turns > 0);
}

export function deathOf(
  statuses: readonly TokenStatus[],
): TokenStatus | undefined {
  return statuses.find(({ kind }) => kind === 'death');
}

export function deathStatus(attempts: number | null): TokenStatus {
  return { kind: 'death', turns: attempts, amount: null, immuneTo: [] };
}

export function savesFromDeath(kind: TokenKind): boolean {
  return kind !== 'threat';
}

export function fallOf(kind: TokenKind): TokenStatus {
  return deathStatus(savesFromDeath(kind) ? DEATH_SAVES : null);
}

export function deathFor(kind: TokenKind, status: TokenStatus): TokenStatus {
  return status.kind === 'death' && !savesFromDeath(kind)
    ? { ...status, turns: null }
    : status;
}

export function failDeathSave(current: readonly TokenStatus[]): TokenStatus[] {
  return current.map((status) =>
    status.kind === 'death' && status.turns !== null
      ? { ...status, turns: status.turns > 1 ? status.turns - 1 : null }
      : status,
  );
}
