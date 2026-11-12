import type { Token } from '../../domain/entities/token';
import type { TableActor } from '../../domain/policies/token-policy';
import type { TokenIcon } from '../../domain/value-objects/token-icon';
import type { TokenKind } from '../../domain/value-objects/token-kind';
import type { TokenSex } from '../../domain/value-objects/token-sex';

export const HIDDEN_TOKEN_NAME = '???';
export const MASKED_TOKEN_KIND: TokenKind = 'npc';

export interface TokenView {
  id: string;
  label: string;
  kind: TokenKind;
  icon: TokenIcon | null;
  sex: TokenSex | null;
  hidden: boolean;
  nameHidden: boolean;
  emitsLight: boolean;
  ownerId: string | null;
  sheetId: string | null;
  col: number;
  row: number;
  size: number;
  version: number;
}

export function toTokenView(token: Token): TokenView {
  return {
    id: token.id,
    label: token.label,
    kind: token.kind,
    icon: token.icon,
    sex: token.sex,
    hidden: token.hidden,
    nameHidden: token.nameHidden,
    emitsLight: token.emitsLight,
    ownerId: token.ownerId,
    sheetId: token.sheetId,
    col: token.col,
    row: token.row,
    size: token.size,
    version: token.version,
  };
}

export function viewForPlayers(view: TokenView): TokenView {
  if (!view.nameHidden) {
    return view;
  }
  return {
    ...view,
    label: HIDDEN_TOKEN_NAME,
    kind: MASKED_TOKEN_KIND,
    icon: null,
    sex: null,
    sheetId: null,
  };
}

export function viewFor(actor: TableActor, view: TokenView): TokenView {
  return actor.role === 'master' ? view : viewForPlayers(view);
}
