import { Injectable } from '@nestjs/common';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import {
  gridPosition,
  type GridPosition,
} from '../../domain/value-objects/grid-position';

export interface TokenDragPreview extends GridPosition {
  id: string;
  by: string;
}

export interface TokenDrag {
  preview: TokenDragPreview;
  hidden: boolean;
}

@Injectable()
export class AuthorizeTokenDragUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(
    actor: TableActor,
    input: { id: string; col: number; row: number },
  ): Promise<TokenDrag> {
    const position = gridPosition(input.col, input.row);
    const token = await this.tokens.findById(input.id);
    if (!token || !TokenPolicy.canSee(actor, token)) {
      throw new TokenNotFoundError();
    }
    TokenPolicy.assertCanMove(actor, token);
    return {
      preview: { id: token.id, by: actor.id, ...position },
      hidden: token.hidden,
    };
  }
}
