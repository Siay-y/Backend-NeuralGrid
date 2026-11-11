import { Injectable } from '@nestjs/common';
import { ChatMessageRepository } from '../../domain/repositories/chat-message.repository';

export const CHAT_RETENTION_LIMIT = 500;
export const CHAT_PRUNE_EVERY = 20;

@Injectable()
export class ChatHistoryRetention {
  private insertsSincePrune = CHAT_PRUNE_EVERY - 1;

  constructor(private readonly messages: ChatMessageRepository) {}

  async recordInsert(): Promise<void> {
    this.insertsSincePrune += 1;
    if (this.insertsSincePrune < CHAT_PRUNE_EVERY) {
      return;
    }
    this.insertsSincePrune = 0;
    try {
      await this.messages.keepNewest(CHAT_RETENTION_LIMIT);
    } catch {
      this.insertsSincePrune = CHAT_PRUNE_EVERY - 1;
    }
  }
}
