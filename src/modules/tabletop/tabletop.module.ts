import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { TokenOwnerValidator } from './application/services/token-owner-validator';
import { AuthorizeTokenDragUseCase } from './application/use-cases/authorize-token-drag.use-case';
import { CreateTokenUseCase } from './application/use-cases/create-token.use-case';
import { DeleteTokenUseCase } from './application/use-cases/delete-token.use-case';
import { ListTokensUseCase } from './application/use-cases/list-tokens.use-case';
import { MoveTokenUseCase } from './application/use-cases/move-token.use-case';
import { UpdateTokenUseCase } from './application/use-cases/update-token.use-case';
import { TokenRepository } from './domain/repositories/token.repository';
import { TokenOrmEntity } from './infrastructure/persistence/typeorm/entities/token.orm-entity';
import { TypeOrmTokenRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-token.repository';
import { PresenceTracker } from './presentation/ws/presence-tracker';
import { TableGateway } from './presentation/ws/table.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([TokenOrmEntity]),
    UsersModule,
    AuthModule,
    ChatModule,
  ],
  providers: [
    { provide: TokenRepository, useClass: TypeOrmTokenRepository },
    TokenOwnerValidator,
    ListTokensUseCase,
    CreateTokenUseCase,
    UpdateTokenUseCase,
    MoveTokenUseCase,
    AuthorizeTokenDragUseCase,
    DeleteTokenUseCase,
    PresenceTracker,
    TableGateway,
  ],
})
export class TabletopModule {}
