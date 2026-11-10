import { Injectable } from '@nestjs/common';
import {
  type ChatActor,
  MessagePolicy,
} from '../../domain/policies/message-policy';
import { ChatMessageRepository } from '../../domain/repositories/chat-message.repository';

export interface ChatCleared {
  by: string;
  removed: number;
}

@Injectable()
export class ClearChatUseCase {
  constructor(private readonly messages: ChatMessageRepository) {}

  async execute(actor: ChatActor): Promise<ChatCleared> {
    MessagePolicy.assertCanClearForEveryone(actor);
    const removed = await this.messages.deleteAll();
    return { by: actor.id, removed };
  }
}
