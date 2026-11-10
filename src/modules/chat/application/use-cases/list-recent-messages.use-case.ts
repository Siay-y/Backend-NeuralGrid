import { Injectable } from '@nestjs/common';
import type { ChatActor } from '../../domain/policies/message-policy';
import { ChatMessageRepository } from '../../domain/repositories/chat-message.repository';
import { type MessageView, toMessageView } from '../dtos/message-view';

export const CHAT_HISTORY_LIMIT = 100;

@Injectable()
export class ListRecentMessagesUseCase {
  constructor(private readonly messages: ChatMessageRepository) {}

  async execute(actor: ChatActor): Promise<MessageView[]> {
    const recent = await this.messages.findRecentVisibleTo(
      actor,
      CHAT_HISTORY_LIMIT,
    );
    return recent.map(toMessageView);
  }
}
