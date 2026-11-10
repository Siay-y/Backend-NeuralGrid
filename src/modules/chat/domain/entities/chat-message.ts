import type { DiceRoll } from '../dice/dice-roll';
import { InvalidMessageError } from '../errors/invalid-message.error';
import {
  isMessageVisibility,
  type MessageKind,
  type MessageVisibility,
} from '../value-objects/message-visibility';

export const MESSAGE_TEXT_MAX_LENGTH = 500;
export const ROLL_LABEL_MAX_LENGTH = 48;

export interface RollRecord extends DiceRoll {
  label: string | null;
}

export interface ChatMessageProps {
  id: string;
  authorId: string | null;
  kind: MessageKind;
  text: string | null;
  roll: RollRecord | null;
  visibility: MessageVisibility;
  recipientId: string | null;
  createdAt: Date;
}

export interface MessageAudience {
  visibility: MessageVisibility;
  recipientId: string | null;
}

interface NewMessageBase extends MessageAudience {
  id: string;
  authorId: string;
  now: Date;
}

export interface NewTextMessage extends NewMessageBase {
  text: string;
}

export interface NewRollMessage extends NewMessageBase {
  label: string | null;
  roll: DiceRoll;
}

function assertAudience(
  authorId: string,
  audience: MessageAudience,
): MessageAudience {
  if (!isMessageVisibility(audience.visibility)) {
    throw new InvalidMessageError('Visibilidade desconhecida');
  }
  if (audience.visibility !== 'whisper') {
    if (audience.recipientId !== null) {
      throw new InvalidMessageError('Só um sussurro tem destinatário');
    }
    return audience;
  }
  if (audience.recipientId === null) {
    throw new InvalidMessageError('Escolha para quem sussurrar');
  }
  if (audience.recipientId === authorId) {
    throw new InvalidMessageError('Você não pode sussurrar para si mesmo');
  }
  return audience;
}

function assertText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MESSAGE_TEXT_MAX_LENGTH) {
    throw new InvalidMessageError(
      `A mensagem precisa ter entre 1 e ${MESSAGE_TEXT_MAX_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

function normalizeLabel(label: string | null): string | null {
  const trimmed = label?.trim() ?? '';
  if (trimmed.length > ROLL_LABEL_MAX_LENGTH) {
    throw new InvalidMessageError(
      `O nome da rolagem pode ter até ${ROLL_LABEL_MAX_LENGTH} caracteres`,
    );
  }
  return trimmed.length > 0 ? trimmed : null;
}

export class ChatMessage {
  private constructor(private readonly props: Readonly<ChatMessageProps>) {}

  static text(input: NewTextMessage): ChatMessage {
    const audience = assertAudience(input.authorId, input);
    return new ChatMessage({
      id: input.id,
      authorId: input.authorId,
      kind: 'text',
      text: assertText(input.text),
      roll: null,
      visibility: audience.visibility,
      recipientId: audience.recipientId,
      createdAt: input.now,
    });
  }

  static roll(input: NewRollMessage): ChatMessage {
    const audience = assertAudience(input.authorId, input);
    return new ChatMessage({
      id: input.id,
      authorId: input.authorId,
      kind: 'roll',
      text: null,
      roll: { ...input.roll, label: normalizeLabel(input.label) },
      visibility: audience.visibility,
      recipientId: audience.recipientId,
      createdAt: input.now,
    });
  }

  static restore(props: ChatMessageProps): ChatMessage {
    return new ChatMessage({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get authorId(): string | null {
    return this.props.authorId;
  }

  get kind(): MessageKind {
    return this.props.kind;
  }

  get text(): string | null {
    return this.props.text;
  }

  get roll(): RollRecord | null {
    return this.props.roll;
  }

  get visibility(): MessageVisibility {
    return this.props.visibility;
  }

  get recipientId(): string | null {
    return this.props.recipientId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
