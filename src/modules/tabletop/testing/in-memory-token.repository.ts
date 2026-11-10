import type { Token } from '../domain/entities/token';
import { TokenRepository } from '../domain/repositories/token.repository';

export class InMemoryTokenRepository extends TokenRepository {
  private readonly tokens = new Map<string, Token>();

  findAll(): Promise<Token[]> {
    return Promise.resolve([...this.tokens.values()]);
  }

  findById(id: string): Promise<Token | null> {
    return Promise.resolve(this.tokens.get(id) ?? null);
  }

  save(token: Token): Promise<void> {
    this.tokens.set(token.id, token);
    return Promise.resolve();
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.tokens.delete(id));
  }
}
