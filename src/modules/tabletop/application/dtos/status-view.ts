import type { Token } from '../../domain/entities/token';
import type { TableActor } from '../../domain/policies/token-policy';
import type { TokenStatus } from '../../domain/value-objects/token-status';

export interface TokenStatusesView {
  tokenId: string;
  statuses: TokenStatus[];
}

export interface StatusChange extends TokenStatusesView {
  hidden: boolean;
}

// Players only receive the effects on tokens they can see, so the statuses of
// a hidden enemy never reach their browser.
export function statusesFor(
  actor: TableActor,
  statuses: ReadonlyMap<string, TokenStatus[]>,
  tokens: readonly Token[],
): TokenStatusesView[] {
  return tokens
    .filter((token) => actor.role === 'master' || !token.hidden)
    .map((token) => ({
      tokenId: token.id,
      statuses: statuses.get(token.id) ?? [],
    }))
    .filter(({ statuses: list }) => list.length > 0);
}
