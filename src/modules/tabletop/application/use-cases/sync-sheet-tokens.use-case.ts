import { Injectable } from '@nestjs/common';
import type { SheetView } from '../../../sheets/application/dtos/sheet-view';
import { TokenRepository } from '../../domain/repositories/token.repository';
import { toTokenView } from '../dtos/token-view';
import { matchesIdentity, sheetIdentity } from '../services/token-sheet-link';
import type { TokenChange } from './update-token.use-case';

@Injectable()
export class SyncSheetTokensUseCase {
  constructor(private readonly tokens: TokenRepository) {}

  async execute(sheet: SheetView): Promise<TokenChange[]> {
    const identity = sheetIdentity(sheet);
    const linked = await this.tokens.findBySheet(sheet.id);
    const now = new Date();
    const synced: TokenChange[] = [];
    for (const token of linked) {
      if (matchesIdentity(token.details, identity)) {
        continue;
      }
      const updated = token.withDetails({ ...token.details, ...identity }, now);
      await this.tokens.save(updated);
      synced.push({ token: toTokenView(updated), wasHidden: token.hidden });
    }
    return synced;
  }
}
