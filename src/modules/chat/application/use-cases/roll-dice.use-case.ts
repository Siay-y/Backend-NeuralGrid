import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { parseDiceFormula } from '../../domain/dice/dice-formula';
import { rollDiceFormula } from '../../domain/dice/dice-roll';
import {
  ChatMessage,
  type MessageAudience,
} from '../../domain/entities/chat-message';
import type { ChatActor } from '../../domain/policies/message-policy';
import { ChatMessageRepository } from '../../domain/repositories/chat-message.repository';
import { type MessageView, toMessageView } from '../dtos/message-view';
import { RandomSource } from '../ports/random-source';
import { MessageAudienceValidator } from '../services/message-audience-validator';

export interface RollDiceInput extends MessageAudience {
  expression: string;
  label: string | null;
}

@Injectable()
export class RollDiceUseCase {
  constructor(
    private readonly messages: ChatMessageRepository,
    private readonly audience: MessageAudienceValidator,
    private readonly random: RandomSource,
  ) {}

  async execute(actor: ChatActor, input: RollDiceInput): Promise<MessageView> {
    const formula = parseDiceFormula(input.expression);
    const roll = rollDiceFormula(formula, (min, max) =>
      this.random.integer(min, max),
    );
    const message = ChatMessage.roll({
      id: randomUUID(),
      authorId: actor.id,
      label: input.label,
      roll,
      visibility: input.visibility,
      recipientId: input.recipientId,
      now: new Date(),
    });
    await this.audience.assertValid(message);
    await this.messages.save(message);
    return toMessageView(message);
  }
}
