import type { Token } from '../../domain/entities/token';
import type { TokenIcon } from '../../domain/value-objects/token-icon';
import type { TokenKind } from '../../domain/value-objects/token-kind';

export interface TokenView {
  id: string;
  label: string;
  kind: TokenKind;
  icon: TokenIcon | null;
  hidden: boolean;
  ownerId: string | null;
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
    hidden: token.hidden,
    ownerId: token.ownerId,
    col: token.col,
    row: token.row,
    size: token.size,
    version: token.version,
  };
}
