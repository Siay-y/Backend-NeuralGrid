import { Injectable } from '@nestjs/common';
import type { SheetView } from '../../../sheets/application/dtos/sheet-view';
import { FindSheetUseCase } from '../../../sheets/application/use-cases/sheet-use-cases';
import {
  TOKEN_LABEL_MAX_LENGTH,
  type TokenDetails,
} from '../../domain/entities/token';
import { InvalidTokenError } from '../../domain/errors/invalid-token.error';

export type SheetIdentity = Pick<
  TokenDetails,
  'label' | 'kind' | 'sex' | 'ownerId'
>;

export function sheetIdentity(sheet: SheetView): SheetIdentity {
  const { name, codename, sex } = sheet.data.identity;
  const label = (codename.trim() || name.trim())
    .slice(0, TOKEN_LABEL_MAX_LENGTH)
    .trim();
  return {
    label: label || 'Sem nome',
    kind: sheet.kind,
    sex,
    ownerId: sheet.ownerId,
  };
}

export function matchesIdentity(
  details: TokenDetails,
  identity: SheetIdentity,
): boolean {
  return (
    details.label === identity.label &&
    details.kind === identity.kind &&
    details.sex === identity.sex &&
    details.ownerId === identity.ownerId
  );
}

@Injectable()
export class TokenSheetLink {
  constructor(private readonly findSheet: FindSheetUseCase) {}

  async identity(sheetId: string | null): Promise<SheetIdentity | null> {
    if (sheetId === null) {
      return null;
    }
    const sheet = await this.findSheet.execute(sheetId);
    if (!sheet) {
      throw new InvalidTokenError('A ficha escolhida não existe mais');
    }
    return sheetIdentity(sheet);
  }
}
