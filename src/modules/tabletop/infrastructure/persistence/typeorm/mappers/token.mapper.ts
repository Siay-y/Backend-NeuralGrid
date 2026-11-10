import { Token } from '../../../../domain/entities/token';
import { TokenOrmEntity } from '../entities/token.orm-entity';

export const TokenMapper = {
  toDomain(row: TokenOrmEntity): Token {
    return Token.restore({
      id: row.id,
      label: row.label,
      kind: row.kind,
      icon: row.icon,
      hidden: row.hidden,
      ownerId: row.ownerId,
      col: row.col,
      row: row.row,
      size: row.size,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toOrm(token: Token): TokenOrmEntity {
    const row = new TokenOrmEntity();
    row.id = token.id;
    row.label = token.label;
    row.kind = token.kind;
    row.icon = token.icon;
    row.hidden = token.hidden;
    row.ownerId = token.ownerId;
    row.col = token.col;
    row.row = token.row;
    row.size = token.size;
    row.version = token.version;
    row.createdAt = token.createdAt;
    row.updatedAt = token.updatedAt;
    return row;
  },
};
