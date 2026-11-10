import { Injectable } from '@nestjs/common';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import type { TokenIcon } from '../../domain/value-objects/token-icon';
import type { TokenKind } from '../../domain/value-objects/token-kind';
import type { TokenSex } from '../../domain/value-objects/token-sex';
import { toTokenView, TokenView } from '../dtos/token-view';
import { TokenOwnerValidator } from '../services/token-owner-validator';

export interface UpdateTokenInput {
  id: string;
  label?: string;
  kind?: TokenKind;
  icon?: TokenIcon | null;
  sex?: TokenSex | null;
  hidden?: boolean;
  nameHidden?: boolean;
  ownerId?: string | null;
  size?: number;
}

export interface TokenChange {
  token: TokenView;
  wasHidden: boolean;
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
  ): Promise<TokenChange> {
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
        icon: input.icon === undefined ? token.icon : input.icon,
        sex: input.sex === undefined ? token.sex : input.sex,
        hidden: input.hidden ?? token.hidden,
        nameHidden: input.nameHidden ?? token.nameHidden,
        size: input.size ?? token.size,
        ownerId,
      },
      new Date(),
    );
    await this.tokens.save(updated);
    return { token: toTokenView(updated), wasHidden: token.hidden };
  }
}
