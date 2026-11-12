import { Token } from '../../../../domain/entities/token';
import { TokenOrmEntity } from '../entities/token.orm-entity';

export const TokenMapper = {
  toDomain(row: TokenOrmEntity): Token {
    return Token.restore({
      id: row.id,
      label: row.label,
      kind: row.kind,
      icon: row.icon,
      sex: row.sex,
      hidden: row.hidden,
      nameHidden: row.nameHidden,
      emitsLight: row.emitsLight,
      ownerId: row.ownerId,
      sheetId: row.sheetId,
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
    row.sex = token.sex;
    row.hidden = token.hidden;
    row.nameHidden = token.nameHidden;
    row.emitsLight = token.emitsLight;
    row.ownerId = token.ownerId;
    row.sheetId = token.sheetId;
    row.col = token.col;
    row.row = token.row;
    row.size = token.size;
    row.version = token.version;
    row.createdAt = token.createdAt;
    row.updatedAt = token.updatedAt;
    return row;
  },
};
