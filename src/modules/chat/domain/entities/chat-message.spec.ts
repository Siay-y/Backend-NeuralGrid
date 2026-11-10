import { InvalidMessageError } from '../errors/invalid-message.error';
import { type ChatActor, MessagePolicy } from '../policies/message-policy';
import { ChatMessage, type NewTextMessage } from './chat-message';

const master: ChatActor = { id: 'master', role: 'master' };
const ana: ChatActor = { id: 'ana', role: 'player' };
const bruno: ChatActor = { id: 'bruno', role: 'player' };

function text(overrides: Partial<NewTextMessage> = {}): ChatMessage {
  return ChatMessage.text({
    id: 'message-1',
    authorId: ana.id,
    text: 'Olá, mesa',
    visibility: 'public',
    recipientId: null,
    now: new Date('2026-11-10T20:00:00Z'),
    ...overrides,
  });
}

describe('ChatMessage', () => {
  it('trims the text', () => {
    expect(text({ text: '   oi   ' }).text).toBe('oi');
  });

  it.each([
    [{ text: '   ' }, 'entre 1 e 500'],
    [{ text: 'a'.repeat(501) }, 'entre 1 e 500'],
    [{ visibility: 'whisper' as const }, 'para quem sussurrar'],
    [{ visibility: 'whisper' as const, recipientId: ana.id }, 'para si mesmo'],
    [{ recipientId: bruno.id }, 'Só um sussurro'],
  ])('rejects %j', (overrides, reason) => {
    expect(() => text(overrides)).toThrow(InvalidMessageError);
    expect(() => text(overrides)).toThrow(reason);
  });

  it('stores a blank roll label as null', () => {
    const message = ChatMessage.roll({
      id: 'roll-1',
      authorId: ana.id,
      label: '   ',
      roll: { notation: '1d20', terms: [], total: 12 },
      visibility: 'public',
      recipientId: null,
      now: new Date(),
    });

    expect(message.roll?.label).toBeNull();
    expect(message.text).toBeNull();
  });
});

describe('MessagePolicy.canSee', () => {
  it('shows public messages to everyone', () => {
    const message = text();
    expect(
      [master, ana, bruno].every((viewer) =>
        MessagePolicy.canSee(viewer, message),
      ),
    ).toBe(true);
  });

  it('shows a gm message to its author and the master only', () => {
    const message = text({ visibility: 'gm' });

    expect(MessagePolicy.canSee(ana, message)).toBe(true);
    expect(MessagePolicy.canSee(master, message)).toBe(true);
    expect(MessagePolicy.canSee(bruno, message)).toBe(false);
  });

  it('keeps a hidden master roll away from players', () => {
    const message = text({ authorId: master.id, visibility: 'gm' });

    expect(MessagePolicy.canSee(master, message)).toBe(true);
    expect(MessagePolicy.canSee(ana, message)).toBe(false);
  });

  it('shows a whisper to its author and recipient only', () => {
    const message = text({ visibility: 'whisper', recipientId: bruno.id });

    expect(MessagePolicy.canSee(ana, message)).toBe(true);
    expect(MessagePolicy.canSee(bruno, message)).toBe(true);
    expect(MessagePolicy.canSee(master, message)).toBe(false);
  });
});
