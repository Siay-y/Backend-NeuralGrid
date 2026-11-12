import type { DataSourceOptions } from 'typeorm';
import { MapOrmEntity } from '../../modules/maps/infrastructure/persistence/typeorm/map.orm-entity';
import { MapAreaOrmEntity } from '../../modules/maps/infrastructure/persistence/typeorm/map-area.orm-entity';
import { TableSettingsOrmEntity } from '../../modules/maps/infrastructure/persistence/typeorm/table-settings.orm-entity';
import { FogExploredOrmEntity } from '../../modules/maps/infrastructure/persistence/typeorm/fog-explored.orm-entity';
import { ChatMessageOrmEntity } from '../../modules/chat/infrastructure/persistence/typeorm/entities/chat-message.orm-entity';
import { SheetOrmEntity } from '../../modules/sheets/infrastructure/persistence/typeorm/sheet.orm-entity';
import { DrawingOrmEntity } from '../../modules/tabletop/infrastructure/persistence/typeorm/entities/drawing.orm-entity';
import { TokenOrmEntity } from '../../modules/tabletop/infrastructure/persistence/typeorm/entities/token.orm-entity';
import { CombatOrmEntity } from '../../modules/tabletop/infrastructure/persistence/typeorm/entities/combat.orm-entity';
import { UserOrmEntity } from '../../modules/users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import { DatabaseSslMode } from './database-ssl-mode';
import { CreateUsers1762790400000 } from './migrations/1762790400000-create-users';
import { CreateTokens1763337600000 } from './migrations/1763337600000-create-tokens';
import { CreateChatMessages1763942400000 } from './migrations/1763942400000-create-chat-messages';
import { AddTokenIconAndVisibility1764547200000 } from './migrations/1764547200000-add-token-icon-and-visibility';
import { AddTokenSexAndNameVisibility1765152000000 } from './migrations/1765152000000-add-token-sex-and-name-visibility';
import { CreateDrawings1765756800000 } from './migrations/1765756800000-create-drawings';
import { CreateCharacterSheets1766361600000 } from './migrations/1766361600000-create-character-sheets';
import { AddSheetVisibility1766966400000 } from './migrations/1766966400000-add-sheet-visibility';
import { AddSheetStatsVisibility1767571200000 } from './migrations/1767571200000-add-sheet-stats-visibility';
import { CreateMaps1768176000000 } from './migrations/1768176000000-create-maps';
import { CreateTableSettings1768780800000 } from './migrations/1768780800000-create-table-settings';
import { AddTokenLight1768867200000 } from './migrations/1768867200000-add-token-light';
import { AddFogMemory1768953600000 } from './migrations/1768953600000-add-fog-memory';
import { CreateCombat1769040000000 } from './migrations/1769040000000-create-combat';

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
    entities: [
      UserOrmEntity,
      TokenOrmEntity,
      ChatMessageOrmEntity,
      DrawingOrmEntity,
      SheetOrmEntity,
      MapOrmEntity,
      MapAreaOrmEntity,
      TableSettingsOrmEntity,
      FogExploredOrmEntity,
      CombatOrmEntity,
    ],
    migrations: [
      CreateUsers1762790400000,
      CreateTokens1763337600000,
      CreateChatMessages1763942400000,
      AddTokenIconAndVisibility1764547200000,
      AddTokenSexAndNameVisibility1765152000000,
      CreateDrawings1765756800000,
      CreateCharacterSheets1766361600000,
      AddSheetVisibility1766966400000,
      AddSheetStatsVisibility1767571200000,
      CreateMaps1768176000000,
      CreateTableSettings1768780800000,
      AddTokenLight1768867200000,
      AddFogMemory1768953600000,
      CreateCombat1769040000000,
    ],
    migrationsTableName: 'typeorm_migrations',
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    synchronize: false,
  };
}
