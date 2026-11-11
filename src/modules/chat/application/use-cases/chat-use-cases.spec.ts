import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import { ChatHistoryRetention } from '../services/chat-history-retention';
import { User } from '../../../users/domain/entities/user';
import { Username } from '../../../users/domain/value-objects/username';
import { InMemoryUserRepository } from '../../../users/testing/in-memory-user.repository';
import { InvalidDiceExpressionError } from '../../domain/errors/invalid-dice-expression.error';
import { InvalidMessageError } from '../../domain/errors/invalid-message.error';
import type { ChatActor } from '../../domain/policies/message-policy';
import { InMemoryChatMessageRepository } from '../../testing/in-memory-chat-message.repository';
import { ScriptedRandomSource } from '../../testing/scripted-random-source';
import { MessageAudienceValidator } from '../services/message-audience-validator';
import { ChatForbiddenError } from '../../domain/errors/chat-forbidden.error';
import { ClearChatUseCase } from './clear-chat.use-case';
import { ListRecentMessagesUseCase } from './list-recent-messages.use-case';
import { RollDiceUseCase } from './roll-dice.use-case';
import { SendMessageUseCase } from './send-message.use-case';

const master: ChatActor = { id: 'master-1', role: 'master' };
const ana: ChatActor = { id: 'player-1', role: 'player' };
const bruno: ChatActor = { id: 'player-2', role: 'player' };

const everyone = { visibility: 'public' as const, recipientId: null };

describe('chat use cases', () => {
  let messages: InMemoryChatMessageRepository;
  let send: SendMessageUseCase;
  let roll: RollDiceUseCase;
  let list: ListRecentMessagesUseCase;

  beforeEach(async () => {
    const users = new InMemoryUserRepository();
    for (const actor of [master, ana, bruno]) {
      await users.save(
        User.create({
          id: actor.id,
          username: Username.create(actor.id),
          displayName: actor.id,
          role: actor.role,
          passwordHash: 'hash',
          now: new Date(),
        }),
      );
    }

    messages = new InMemoryChatMessageRepository();
    const audience = new MessageAudienceValidator(
      new GetUserByIdUseCase(users),
    );
    const retention = new ChatHistoryRetention(messages);
    send = new SendMessageUseCase(messages, audience, retention);
    roll = new RollDiceUseCase(
      messages,
      audience,
      retention,
      new ScriptedRandomSource([12, 19, 3]),
    );
    list = new ListRecentMessagesUseCase(messages);
  });

  it('stores and returns a text message', async () => {
    const view = await send.execute(ana, { text: ' boa noite ', ...everyone });

    expect(view).toMatchObject({
      authorId: ana.id,
      kind: 'text',
      text: 'boa noite',
      roll: null,
      visibility: 'public',
    });
    expect(messages.messages).toHaveLength(1);
  });

  it('rolls on the server and records every die', async () => {
    const view = await roll.execute(ana, {
      expression: '3d20kh1+5',
      label: 'Ocultismo',
      ...everyone,
    });

    expect(view.kind).toBe('roll');
    expect(view.roll).toMatchObject({
      label: 'Ocultismo',
      notation: '3d20kh1+5',
      total: 24,
    });
  });

  it('refuses an invalid expression without storing anything', async () => {
    await expect(
      roll.execute(ana, { expression: '1d1000', label: null, ...everyone }),
    ).rejects.toThrow(InvalidDiceExpressionError);
    expect(messages.messages).toHaveLength(0);
  });

  it('refuses a whisper to someone outside the table', async () => {
    await expect(
      send.execute(ana, {
        text: 'psiu',
        visibility: 'whisper',
        recipientId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toThrow(InvalidMessageError);
  });

  it('lists only what each person may see', async () => {
    await send.execute(ana, { text: 'para todos', ...everyone });
    await roll.execute(master, {
      expression: '1d20',
      label: 'Oculta',
      visibility: 'gm',
      recipientId: null,
    });
    await send.execute(ana, {
      text: 'para o Bruno',
      visibility: 'whisper',
      recipientId: bruno.id,
    });

    const texts = async (viewer: ChatActor) =>
      (await list.execute(viewer)).map(
        (message) => message.text ?? message.roll?.label,
      );

    expect(await texts(master)).toEqual(['para todos', 'Oculta']);
    expect(await texts(ana)).toEqual(['para todos', 'para o Bruno']);
    expect(await texts(bruno)).toEqual(['para todos', 'para o Bruno']);
  });

  it('lets only the master clear the chat for everyone', async () => {
    const clear = new ClearChatUseCase(messages);
    await send.execute(ana, { text: 'uma', ...everyone });
    await send.execute(bruno, { text: 'duas', ...everyone });

    await expect(clear.execute(ana)).rejects.toThrow(ChatForbiddenError);
    expect(messages.messages).toHaveLength(2);

    expect(await clear.execute(master)).toEqual({ by: master.id, removed: 2 });
    expect(await list.execute(ana)).toEqual([]);
  });
});
