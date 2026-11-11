import type { ChatMessage } from '../domain/entities/chat-message';
import {
  type ChatActor,
  MessagePolicy,
} from '../domain/policies/message-policy';
import { ChatMessageRepository } from '../domain/repositories/chat-message.repository';

export class InMemoryChatMessageRepository extends ChatMessageRepository {
  readonly messages: ChatMessage[] = [];

  save(message: ChatMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  deleteAll(): Promise<number> {
    const removed = this.messages.length;
    this.messages.length = 0;
    return Promise.resolve(removed);
  }

  keepNewest(limit: number): Promise<number> {
    const sorted = [...this.messages].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const removed = Math.max(0, sorted.length - limit);
    this.messages.splice(0, this.messages.length, ...sorted.slice(removed));
    return Promise.resolve(removed);
  }

  findRecentVisibleTo(
    viewer: ChatActor,
    limit: number,
  ): Promise<ChatMessage[]> {
    const visible = this.messages
      .filter((message) => MessagePolicy.canSee(viewer, message))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Promise.resolve(visible.slice(-limit));
  }
}
