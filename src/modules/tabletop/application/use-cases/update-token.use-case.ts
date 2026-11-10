import { Injectable } from '@nestjs/common';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import type { TokenKind } from '../../domain/value-objects/token-kind';
import { toTokenView, TokenView } from '../dtos/token-view';
import { TokenOwnerValidator } from '../services/token-owner-validator';

export interface UpdateTokenInput {
  id: string;
  label?: string;
  kind?: TokenKind;
  ownerId?: string | null;
  size?: number;
}

@Injectable()
export class UpdateTokenUseCase {
  constructor(
    private readonly tokens: TokenRepository,
    private readonly owners: TokenOwnerValidator,
  ) {}

  async execute(
    actor: TableActor,
    input: UpdateTokenInput,
  ): Promise<TokenView> {
    TokenPolicy.assertCanManage(actor);

    const token = await this.tokens.findById(input.id);
    if (!token) {
      throw new TokenNotFoundError();
    }

    const ownerId = input.ownerId === undefined ? token.ownerId : input.ownerId;
    if (ownerId !== token.ownerId) {
      await this.owners.assertValid(ownerId);
    }

    const updated = token.withDetails(
      {
        label: input.label ?? token.label,
        kind: input.kind ?? token.kind,
        size: input.size ?? token.size,
        ownerId,
      },
      new Date(),
    );
    await this.tokens.save(updated);
    return toTokenView(updated);
  }
}
