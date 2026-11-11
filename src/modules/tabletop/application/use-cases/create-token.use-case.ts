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
import type { TokenSex } from '../../domain/value-objects/token-sex';
import { toTokenView, TokenView } from '../dtos/token-view';
import { TokenOwnerValidator } from '../services/token-owner-validator';
import { TokenSheetLink } from '../services/token-sheet-link';

export interface CreateTokenInput {
  label: string;
  kind: TokenKind;
  icon: TokenIcon | null;
  sex: TokenSex | null;
  hidden: boolean;
  nameHidden: boolean;
  ownerId: string | null;
  sheetId: string | null;
  col: number;
  row: number;
  size: number;
}

@Injectable()
export class CreateTokenUseCase {
  constructor(
    private readonly tokens: TokenRepository,
    private readonly owners: TokenOwnerValidator,
    private readonly sheets: TokenSheetLink,
  ) {}

  async execute(
    actor: TableActor,
    input: CreateTokenInput,
  ): Promise<TokenView> {
    TokenPolicy.assertCanManage(actor);
    const linked = await this.sheets.identity(input.sheetId);
    const details = { ...input, ...linked };
    await this.owners.assertValid(details.ownerId);

    const token = Token.create({
      id: randomUUID(),
      ...details,
      now: new Date(),
    });
    await this.tokens.save(token);
    return toTokenView(token);
  }
}
