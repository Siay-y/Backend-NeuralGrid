import type {
  ChatMessage,
  RollRecord,
} from '../../domain/entities/chat-message';
import type {
  MessageKind,
  MessageVisibility,
} from '../../domain/value-objects/message-visibility';

export interface MessageView {
  id: string;
  authorId: string | null;
  kind: MessageKind;
  text: string | null;
  roll: RollRecord | null;
  visibility: MessageVisibility;
  recipientId: string | null;
  createdAt: string;
}

export function toMessageView(message: ChatMessage): MessageView {
  return {
    id: message.id,
    authorId: message.authorId,
    kind: message.kind,
    text: message.text,
    roll: message.roll,
    visibility: message.visibility,
    recipientId: message.recipientId,
    createdAt: message.createdAt.toISOString(),
  };
}
