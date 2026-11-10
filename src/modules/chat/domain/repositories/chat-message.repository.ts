import type { ChatMessage } from '../entities/chat-message';
import type { ChatActor } from '../policies/message-policy';

export abstract class ChatMessageRepository {
  abstract save(message: ChatMessage): Promise<void>;

  abstract deleteAll(): Promise<number>;

  abstract findRecentVisibleTo(
    viewer: ChatActor,
    limit: number,
  ): Promise<ChatMessage[]>;
}
