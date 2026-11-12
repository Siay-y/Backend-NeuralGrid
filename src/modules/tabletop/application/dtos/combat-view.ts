import {
  type Combat,
  leaveCombat,
  turnOrder,
} from '../../domain/entities/combat';
import type { Token } from '../../domain/entities/token';

export interface CombatantView {
  tokenId: string;
  initiative: number | null;
  hidden: boolean;
}

export interface CombatView {
  round: number;
  turnId: string | null;
  combatants: CombatantView[];
}

export interface CombatViews {
  master: CombatView;
  players: CombatView;
}

export function withoutMissingTokens(
  combat: Combat,
  tokens: ReadonlyMap<string, Token>,
): Combat {
  const missing = combat.combatants
    .filter(({ tokenId }) => !tokens.has(tokenId))
    .map(({ tokenId }) => tokenId);
  return missing.length > 0 ? leaveCombat(combat, missing) : combat;
}

// Players never receive a combatant the master keeps out of the list, nor one
// whose token is hidden, so an ambush stays secret until it is revealed.
export function toCombatViews(
  stored: Combat,
  tokens: ReadonlyMap<string, Token>,
): CombatViews {
  const combat = withoutMissingTokens(stored, tokens);
  const master: CombatView = {
    round: combat.round,
    turnId: combat.turnId,
    combatants: turnOrder(combat.combatants).map(
      ({ tokenId, initiative, hidden }) => ({ tokenId, initiative, hidden }),
    ),
  };
  const visible = master.combatants.filter(
    ({ tokenId, hidden }) => !hidden && tokens.get(tokenId)?.hidden === false,
  );
  return {
    master,
    players: {
      round: combat.round,
      turnId: visible.some(({ tokenId }) => tokenId === combat.turnId)
        ? combat.turnId
        : null,
      combatants: visible,
    },
  };
}

export function viewForActor(
  views: CombatViews,
  actor: { role: string },
): CombatView {
  return actor.role === 'master' ? views.master : views.players;
}
