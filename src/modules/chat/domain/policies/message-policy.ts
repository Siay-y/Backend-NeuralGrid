import type { UserRole } from '../../../users/domain/value-objects/user-role';
import type { ChatMessage } from '../entities/chat-message';
import { ChatForbiddenError } from '../errors/chat-forbidden.error';

export interface ChatActor {
  id: string;
  role: UserRole;
}

export const MessagePolicy = {
  canSee(viewer: ChatActor, message: ChatMessage): boolean {
    if (message.visibility === 'public' || message.authorId === viewer.id) {
      return true;
    }
    if (message.visibility === 'gm') {
      return viewer.role === 'master';
    }
    return message.recipientId === viewer.id;
  },

  assertCanClearForEveryone(actor: ChatActor): void {
    if (actor.role !== 'master') {
      throw new ChatForbiddenError(
        'Só o mestre pode limpar o chat de toda a mesa',
      );
    }
  },
};
