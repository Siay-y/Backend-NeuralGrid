import { Injectable } from '@nestjs/common';
import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import type { MessageAudience } from '../../domain/entities/chat-message';
import { InvalidMessageError } from '../../domain/errors/invalid-message.error';

@Injectable()
export class MessageAudienceValidator {
  constructor(private readonly getUserById: GetUserByIdUseCase) {}

  async assertValid(audience: MessageAudience): Promise<void> {
    if (audience.visibility !== 'whisper' || audience.recipientId === null) {
      return;
    }
    const recipient = await this.getUserById.execute(audience.recipientId);
    if (!recipient) {
      throw new InvalidMessageError('O destinatário não faz parte da mesa');
    }
  }
}
