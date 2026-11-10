import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import type { ChatMessage } from '../../../../domain/entities/chat-message';
import type { ChatActor } from '../../../../domain/policies/message-policy';
import { ChatMessageRepository } from '../../../../domain/repositories/chat-message.repository';
import { ChatMessageOrmEntity } from '../entities/chat-message.orm-entity';
import { ChatMessageMapper } from '../mappers/chat-message.mapper';

@Injectable()
export class TypeOrmChatMessageRepository extends ChatMessageRepository {
  constructor(
    @InjectRepository(ChatMessageOrmEntity)
    private readonly rows: Repository<ChatMessageOrmEntity>,
  ) {
    super();
  }

  async save(message: ChatMessage): Promise<void> {
    await this.rows.insert(ChatMessageMapper.toOrm(message));
  }

  async deleteAll(): Promise<number> {
    const result = await this.rows.createQueryBuilder().delete().execute();
    return result.affected ?? 0;
  }

  async findRecentVisibleTo(
    viewer: ChatActor,
    limit: number,
  ): Promise<ChatMessage[]> {
    const rows = await this.rows
      .createQueryBuilder('message')
      .where(
        new Brackets((visible) => {
          visible
            .where(`message.visibility = 'public'`)
            .orWhere('message.author_id = :viewerId')
            .orWhere(
              `message.visibility = 'whisper' AND message.recipient_id = :viewerId`,
            );
          if (viewer.role === 'master') {
            visible.orWhere(`message.visibility = 'gm'`);
          }
        }),
      )
      .setParameter('viewerId', viewer.id)
      .orderBy('message.created_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(limit)
      .getMany();

    return rows.reverse().map((row) => ChatMessageMapper.toDomain(row));
  }
}
