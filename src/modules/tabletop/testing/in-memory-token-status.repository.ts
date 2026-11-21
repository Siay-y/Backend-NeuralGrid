import { TokenStatusRepository } from '../domain/repositories/token-status.repository';
import {
  sortStatuses,
  type TokenStatus,
} from '../domain/value-objects/token-status';

function copy(statuses: readonly TokenStatus[]): TokenStatus[] {
  return statuses.map((status) => ({
    ...status,
    immuneTo: [...status.immuneTo],
  }));
}

export class InMemoryTokenStatusRepository extends TokenStatusRepository {
  private readonly byToken = new Map<string, TokenStatus[]>();

  findAll(): Promise<Map<string, TokenStatus[]>> {
    return Promise.resolve(
      new Map(
        [...this.byToken].map(([tokenId, statuses]) => [
          tokenId,
          copy(statuses),
        ]),
      ),
    );
  }

  findByToken(tokenId: string): Promise<TokenStatus[]> {
    return Promise.resolve(copy(this.byToken.get(tokenId) ?? []));
  }

  replace(tokenId: string, statuses: readonly TokenStatus[]): Promise<void> {
    if (statuses.length === 0) {
      this.byToken.delete(tokenId);
    } else {
      this.byToken.set(tokenId, sortStatuses(copy(statuses)));
    }
    return Promise.resolve();
  }
}
