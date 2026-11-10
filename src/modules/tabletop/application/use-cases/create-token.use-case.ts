import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Token } from '../../domain/entities/token';
import {
  type TableActor,
  TokenPolicy,
} from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import type { TokenIcon } from '../../domain/value-objects/token-icon';
import type { TokenKind } from '../../domain/value-objects/token-kind';
import { toTokenView, TokenView } from '../dtos/token-view';
import { TokenOwnerValidator } from '../services/token-owner-validator';

export interface CreateTokenInput {
  label: string;
  kind: TokenKind;
  icon: TokenIcon | null;
  hidden: boolean;
  ownerId: string | null;
  col: number;
  row: number;
  size: number;
}

@Injectable()
export class CreateTokenUseCase {
  constructor(
    private readonly tokens: TokenRepository,
    private readonly owners: TokenOwnerValidator,
  ) {}

  async execute(
    actor: TableActor,
    input: CreateTokenInput,
  ): Promise<TokenView> {
    TokenPolicy.assertCanManage(actor);
    await this.owners.assertValid(input.ownerId);

    const token = Token.create({ id: randomUUID(), ...input, now: new Date() });
    await this.tokens.save(token);
    return toTokenView(token);
  }
}
