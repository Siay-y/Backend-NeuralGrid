import type { Token } from '../entities/token';

export abstract class TokenRepository {
  abstract findAll(): Promise<Token[]>;
  abstract findById(id: string): Promise<Token | null>;
  abstract findBySheet(sheetId: string): Promise<Token[]>;
  abstract save(token: Token): Promise<void>;
  abstract delete(id: string): Promise<boolean>;
}
