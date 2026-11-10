import { Injectable } from '@nestjs/common';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';

export interface TokenRemoval {
  id: string;
  wasHidden: boolean;
}

@Injectable()
export class DeleteTokenUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(actor: TableActor, id: string): Promise<TokenRemoval> {
    TokenPolicy.assertCanManage(actor);
    const token = await this.tokens.findById(id);
    if (!token || !(await this.tokens.delete(id))) {
      throw new TokenNotFoundError();
    }
    return { id, wasHidden: token.hidden };
  }
}
