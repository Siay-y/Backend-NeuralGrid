import { ChatMessage } from '../../../../domain/entities/chat-message';
import { ChatMessageOrmEntity } from '../entities/chat-message.orm-entity';

export const ChatMessageMapper = {
  toDomain(row: ChatMessageOrmEntity): ChatMessage {
    return ChatMessage.restore({
      id: row.id,
      authorId: row.authorId,
      kind: row.kind,
      text: row.text,
      roll: row.roll,
      visibility: row.visibility,
      recipientId: row.recipientId,
      createdAt: row.createdAt,
    });
  },

  toOrm(message: ChatMessage): ChatMessageOrmEntity {
    const row = new ChatMessageOrmEntity();
    row.id = message.id;
    row.authorId = message.authorId;
    row.kind = message.kind;
    row.text = message.text;
    row.roll = message.roll;
    row.visibility = message.visibility;
    row.recipientId = message.recipientId;
    row.createdAt = message.createdAt;
    return row;
  },
};
