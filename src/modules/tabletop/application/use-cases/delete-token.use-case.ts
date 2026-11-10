import { Injectable } from '@nestjs/common';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';

@Injectable()
export class DeleteTokenUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(actor: TableActor, id: string): Promise<{ id: string }> {
    TokenPolicy.assertCanManage(actor);
    const deleted = await this.tokens.delete(id);
    if (!deleted) {
      throw new TokenNotFoundError();
    }
    return { id };
  }
}
