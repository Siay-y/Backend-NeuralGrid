import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { RandomSource } from './application/ports/random-source';
import { ChatHistoryRetention } from './application/services/chat-history-retention';
import { MessageAudienceValidator } from './application/services/message-audience-validator';
import { ClearChatUseCase } from './application/use-cases/clear-chat.use-case';
import { ListRecentMessagesUseCase } from './application/use-cases/list-recent-messages.use-case';
import { RollDiceUseCase } from './application/use-cases/roll-dice.use-case';
import { SendMessageUseCase } from './application/use-cases/send-message.use-case';
import { ChatMessageRepository } from './domain/repositories/chat-message.repository';
import { ChatMessageOrmEntity } from './infrastructure/persistence/typeorm/entities/chat-message.orm-entity';
import { TypeOrmChatMessageRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-chat-message.repository';
import { CryptoRandomSource } from './infrastructure/random/crypto-random-source';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessageOrmEntity]), UsersModule],
  providers: [
    { provide: ChatMessageRepository, useClass: TypeOrmChatMessageRepository },
    { provide: RandomSource, useClass: CryptoRandomSource },
    MessageAudienceValidator,
    ChatHistoryRetention,
    SendMessageUseCase,
    RollDiceUseCase,
    ListRecentMessagesUseCase,
    ClearChatUseCase,
  ],
  exports: [
    SendMessageUseCase,
    RollDiceUseCase,
    ListRecentMessagesUseCase,
    ClearChatUseCase,
  ],
})
export class ChatModule {}
