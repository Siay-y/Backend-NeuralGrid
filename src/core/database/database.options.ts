import type { DataSourceOptions } from 'typeorm';
import { ChatMessageOrmEntity } from '../../modules/chat/infrastructure/persistence/typeorm/entities/chat-message.orm-entity';
import { TokenOrmEntity } from '../../modules/tabletop/infrastructure/persistence/typeorm/entities/token.orm-entity';
import { UserOrmEntity } from '../../modules/users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import { DatabaseSslMode } from './database-ssl-mode';
import { CreateUsers1762790400000 } from './migrations/1762790400000-create-users';
import { CreateTokens1763337600000 } from './migrations/1763337600000-create-tokens';
import { CreateChatMessages1763942400000 } from './migrations/1763942400000-create-chat-messages';
import { AddTokenIconAndVisibility1764547200000 } from './migrations/1764547200000-add-token-icon-and-visibility';
import { AddTokenSexAndNameVisibility1765152000000 } from './migrations/1765152000000-add-token-sex-and-name-visibility';

export interface DatabaseSettings {
  url: string;
  sslMode: DatabaseSslMode;
}

const SSL_BY_MODE = {
  [DatabaseSslMode.Disable]: false,
  [DatabaseSslMode.Require]: { rejectUnauthorized: false },
  [DatabaseSslMode.Verify]: { rejectUnauthorized: true },
} as const;

// node-postgres lets `sslmode` in the URL override the explicit `ssl` option,
// so it is stripped to keep DATABASE_SSL_MODE as the single source of truth.
function withoutSslParameters(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('ssl');
  return url.toString();
}

export function buildDataSourceOptions(
  settings: DatabaseSettings,
): DataSourceOptions {
  return {
    type: 'postgres',
    url: withoutSslParameters(settings.url),
    ssl: SSL_BY_MODE[settings.sslMode],
    entities: [UserOrmEntity, TokenOrmEntity, ChatMessageOrmEntity],
    migrations: [
      CreateUsers1762790400000,
      CreateTokens1763337600000,
      CreateChatMessages1763942400000,
      AddTokenIconAndVisibility1764547200000,
      AddTokenSexAndNameVisibility1765152000000,
    ],
    migrationsTableName: 'typeorm_migrations',
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    synchronize: false,
  };
}
