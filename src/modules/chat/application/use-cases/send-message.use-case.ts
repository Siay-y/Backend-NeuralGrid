import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ChatMessage,
  type MessageAudience,
} from '../../domain/entities/chat-message';
import type { ChatActor } from '../../domain/policies/message-policy';
import { ChatMessageRepository } from '../../domain/repositories/chat-message.repository';
import { type MessageView, toMessageView } from '../dtos/message-view';
import { MessageAudienceValidator } from '../services/message-audience-validator';

export interface SendMessageInput extends MessageAudience {
  text: string;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly audience: MessageAudienceValidator,
  ) {}

  async execute(
    actor: ChatActor,
    input: SendMessageInput,
  ): Promise<MessageView> {
    const message = ChatMessage.text({
      id: randomUUID(),
      authorId: actor.id,
      text: input.text,
      visibility: input.visibility,
      recipientId: input.recipientId,
      now: new Date(),
    });
    await this.audience.assertValid(message);
    await this.messages.save(message);
    return toMessageView(message);
  }
}
