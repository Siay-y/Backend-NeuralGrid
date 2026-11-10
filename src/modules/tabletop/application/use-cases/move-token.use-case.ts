import { Injectable } from '@nestjs/common';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import { toTokenView, TokenView } from '../dtos/token-view';

export interface MoveTokenInput {
  id: string;
  col: number;
  row: number;
}

@Injectable()
export class MoveTokenUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(actor: TableActor, input: MoveTokenInput): Promise<TokenView> {
    const token = await this.tokens.findById(input.id);
    if (!token) {
      throw new TokenNotFoundError();
    }
    TokenPolicy.assertCanMove(actor, token);

    const moved = token.moveTo(input.col, input.row, new Date());
    await this.tokens.save(moved);
    return toTokenView(moved);
  }
}
