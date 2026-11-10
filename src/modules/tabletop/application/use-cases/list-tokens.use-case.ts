import { Injectable } from '@nestjs/common';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import { toTokenView, TokenView } from '../dtos/token-view';

@Injectable()
export class ListTokensUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(actor: TableActor): Promise<TokenView[]> {
    const tokens = await this.tokens.findAll();
    return tokens
      .filter((token) => TokenPolicy.canSee(actor, token))
      .map(toTokenView);
  }
}
