import { InvalidCombatError } from '../errors/invalid-combat.error';

export const COMBAT_LIMITS = {
  combatants: 40,
  minInitiative: -99,
  maxInitiative: 999,
} as const;

export interface Combatant {
  tokenId: string;
  initiative: number | null;
  hidden: boolean;
}

export interface Combat {
  round: number;
  turnId: string | null;
  combatants: readonly Combatant[];
}

export interface CombatantChanges {
  initiative?: number | null;
  hidden?: boolean;
}

export const IDLE_COMBAT: Combat = { round: 0, turnId: null, combatants: [] };

const NOT_IN_COMBAT = 'Esse token não está no combate';

export function turnOrder(combatants: readonly Combatant[]): Combatant[] {
  return combatants
    .map((combatant, index) => ({ combatant, index }))
    .sort((a, b) => {
      const left = a.combatant.initiative;
      const right = b.combatant.initiative;
      if (left !== right) {
        if (left === null) return 1;
        if (right === null) return -1;
        return right - left;
      }
      return a.index - b.index;
    })
    .map(({ combatant }) => combatant);
}

export function hasStarted(combat: Combat): boolean {
  return combat.round > 0;
}

function assertInitiative(value: number | null): number | null {
  if (
    value !== null &&
    (!Number.isInteger(value) ||
      value < COMBAT_LIMITS.minInitiative ||
      value > COMBAT_LIMITS.maxInitiative)
  ) {
    throw new InvalidCombatError(
      `A iniciativa precisa ser um inteiro entre ${COMBAT_LIMITS.minInitiative} e ${COMBAT_LIMITS.maxInitiative}`,
    );
  }
  return value;
}

export function joinCombat(
  combat: Combat,
  entries: readonly Combatant[],
): Combat {
  const known = new Set(combat.combatants.map(({ tokenId }) => tokenId));
  const fresh = entries.filter(({ tokenId }) => {
    if (known.has(tokenId)) {
      return false;
    }
    known.add(tokenId);
    return true;
  });
  if (combat.combatants.length + fresh.length > COMBAT_LIMITS.combatants) {
    throw new InvalidCombatError(
      `O combate aceita até ${COMBAT_LIMITS.combatants} participantes`,
    );
  }
  return {
    ...combat,
    combatants: [
      ...combat.combatants,
      ...fresh.map((entry) => ({
        ...entry,
        initiative: assertInitiative(entry.initiative),
      })),
    ],
  };
}

export function editCombatant(
  combat: Combat,
  tokenId: string,
  changes: CombatantChanges,
): Combat {
  if (!combat.combatants.some((combatant) => combatant.tokenId === tokenId)) {
    throw new InvalidCombatError(NOT_IN_COMBAT);
  }
  return {
    ...combat,
    combatants: combat.combatants.map((combatant) =>
      combatant.tokenId === tokenId
        ? {
            ...combatant,
            initiative:
              changes.initiative === undefined
                ? combatant.initiative
                : assertInitiative(changes.initiative),
            hidden: changes.hidden ?? combatant.hidden,
          }
        : combatant,
    ),
  };
}

export function leaveCombat(
  combat: Combat,
  tokenIds: readonly string[],
): Combat {
  let next = combat;
  for (const tokenId of tokenIds) {
    if (!next.combatants.some((combatant) => combatant.tokenId === tokenId)) {
      continue;
    }
    if (next.turnId === tokenId && next.combatants.length > 1) {
      next = stepTurn(next, 1);
    }
    next = {
      ...next,
      combatants: next.combatants.filter(
        (combatant) => combatant.tokenId !== tokenId,
      ),
    };
  }
  return next.combatants.length === 0 ? IDLE_COMBAT : next;
}

export function startCombat(combat: Combat): Combat {
  const [first] = turnOrder(combat.combatants);
  if (!first) {
    throw new InvalidCombatError('Adicione alguém ao combate primeiro');
  }
  return { ...combat, round: 1, turnId: first.tokenId };
}

export function stepTurn(combat: Combat, step: 1 | -1): Combat {
  if (!hasStarted(combat)) {
    throw new InvalidCombatError('O combate ainda não começou');
  }
  const order = turnOrder(combat.combatants);
  const index = order.findIndex(({ tokenId }) => tokenId === combat.turnId);
  if (index === -1) {
    return { ...combat, turnId: order[0]?.tokenId ?? null };
  }
  const target = index + step;
  if (target >= order.length) {
    return { ...combat, round: combat.round + 1, turnId: order[0].tokenId };
  }
  if (target < 0) {
    return combat.round > 1
      ? {
          ...combat,
          round: combat.round - 1,
          turnId: order[order.length - 1].tokenId,
        }
      : combat;
  }
  return { ...combat, turnId: order[target].tokenId };
}

export function clampInitiative(value: number): number {
  return Math.min(
    COMBAT_LIMITS.maxInitiative,
    Math.max(COMBAT_LIMITS.minInitiative, value),
  );
}

export function initiativeExpression(modifier: number): string {
  if (modifier === 0) {
    return '1d20';
  }
  return modifier > 0 ? `1d20+${modifier}` : `1d20-${-modifier}`;
}
