import type { TokenStatus } from '../value-objects/token-status';

export abstract class TokenStatusRepository {
  abstract findAll(): Promise<Map<string, TokenStatus[]>>;
  abstract findByToken(tokenId: string): Promise<TokenStatus[]>;
  abstract replace(
    tokenId: string,
    statuses: readonly TokenStatus[],
  ): Promise<void>;
}
