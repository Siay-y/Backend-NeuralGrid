import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { SheetsModule } from '../sheets/sheets.module';
import { UsersModule } from '../users/users.module';
import { TokenOwnerValidator } from './application/services/token-owner-validator';
import { TokenSheetLink } from './application/services/token-sheet-link';
import { ClearDrawingsUseCase } from './application/use-cases/clear-drawings.use-case';
import { CreateDrawingUseCase } from './application/use-cases/create-drawing.use-case';
import { EraseDrawingsUseCase } from './application/use-cases/erase-drawings.use-case';
import { ListDrawingsUseCase } from './application/use-cases/list-drawings.use-case';
import { AuthorizeTokenDragUseCase } from './application/use-cases/authorize-token-drag.use-case';
import { CreateTokenUseCase } from './application/use-cases/create-token.use-case';
import { DeleteTokenUseCase } from './application/use-cases/delete-token.use-case';
import { ListTokensUseCase } from './application/use-cases/list-tokens.use-case';
import { MoveTokenUseCase } from './application/use-cases/move-token.use-case';
import { SyncSheetTokensUseCase } from './application/use-cases/sync-sheet-tokens.use-case';
import { UpdateTokenUseCase } from './application/use-cases/update-token.use-case';
import { DrawingRepository } from './domain/repositories/drawing.repository';
import { TokenRepository } from './domain/repositories/token.repository';
import { DrawingOrmEntity } from './infrastructure/persistence/typeorm/entities/drawing.orm-entity';
import { TokenOrmEntity } from './infrastructure/persistence/typeorm/entities/token.orm-entity';
import { TypeOrmDrawingRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-drawing.repository';
import { TypeOrmTokenRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-token.repository';
import { PresenceTracker } from './presentation/ws/presence-tracker';
import { TableGateway } from './presentation/ws/table.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenOrmEntity, DrawingOrmEntity]),
    UsersModule,
    AuthModule,
    ChatModule,
    SheetsModule,
  ],
  providers: [
    { provide: TokenRepository, useClass: TypeOrmTokenRepository },
    { provide: DrawingRepository, useClass: TypeOrmDrawingRepository },
    TokenOwnerValidator,
    TokenSheetLink,
    ListTokensUseCase,
    CreateTokenUseCase,
    UpdateTokenUseCase,
    MoveTokenUseCase,
    AuthorizeTokenDragUseCase,
    DeleteTokenUseCase,
    SyncSheetTokensUseCase,
    ListDrawingsUseCase,
    CreateDrawingUseCase,
    EraseDrawingsUseCase,
    ClearDrawingsUseCase,
    PresenceTracker,
    TableGateway,
  ],
})
export class TabletopModule {}
