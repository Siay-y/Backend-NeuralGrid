import { Injectable } from '@nestjs/common';
import { TokenRepository } from '../../domain/repositories/token.repository';
import { toTokenView, TokenView } from '../dtos/token-view';

@Injectable()
export class ListTokensUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(): Promise<TokenView[]> {
    const tokens = await this.tokens.findAll();
    return tokens.map(toTokenView);
  }
}
