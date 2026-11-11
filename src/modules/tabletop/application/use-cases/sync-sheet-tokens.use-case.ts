import { Injectable } from '@nestjs/common';
import type { SheetView } from '../../../sheets/application/dtos/sheet-view';
import { TokenRepository } from '../../domain/repositories/token.repository';
import { toTokenView, TokenView } from '../dtos/token-view';
import { matchesIdentity, sheetIdentity } from '../services/token-sheet-link';

@Injectable()
export class SyncSheetTokensUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(sheet: SheetView): Promise<TokenView[]> {
    const identity = sheetIdentity(sheet);
    const linked = await this.tokens.findBySheet(sheet.id);
    const now = new Date();
    const synced: TokenView[] = [];
    for (const token of linked) {
      if (matchesIdentity(token.details, identity)) {
        continue;
      }
      const updated = token.withDetails({ ...token.details, ...identity }, now);
      await this.tokens.save(updated);
      synced.push(toTokenView(updated));
    }
    return synced;
  }
}
