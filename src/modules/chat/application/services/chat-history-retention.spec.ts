import { ChatMessage } from '../../domain/entities/chat-message';
import { InMemoryChatMessageRepository } from '../../testing/in-memory-chat-message.repository';
import {
  CHAT_PRUNE_EVERY,
  CHAT_RETENTION_LIMIT,
  ChatHistoryRetention,
} from './chat-history-retention';

const message = (index: number) =>
  ChatMessage.text({
    id: `m${index}`,
    authorId: 'ana',
    text: `mensagem ${index}`,
    visibility: 'public',
    recipientId: null,
    now: new Date(Date.UTC(2026, 10, 10, 0, 0, index)),
  });

class CountingRepository extends InMemoryChatMessageRepository {
  prunes = 0;
  failNext = false;

  keepNewest(limit: number): Promise<number> {
    this.prunes += 1;
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('offline'));
    }
    return super.keepNewest(limit);
  }
}

describe('ChatHistoryRetention', () => {
  it('keeps only the newest messages, pruning in batches', async () => {
    const messages = new CountingRepository();
    const retention = new ChatHistoryRetention(messages);
    let largest = 0;

    for (let index = 0; index <= CHAT_RETENTION_LIMIT * 2; index++) {
      await messages.save(message(index));
      await retention.recordInsert();
      largest = Math.max(largest, messages.messages.length);
    }

    expect(messages.prunes).toBe(
      Math.ceil((CHAT_RETENTION_LIMIT * 2 + 1) / CHAT_PRUNE_EVERY),
    );
    expect(messages.messages).toHaveLength(CHAT_RETENTION_LIMIT);
    expect(messages.messages.at(-1)?.id).toBe(`m${CHAT_RETENTION_LIMIT * 2}`);
    expect(largest).toBeLessThan(CHAT_RETENTION_LIMIT + CHAT_PRUNE_EVERY);
  });

  it('tries again on the next message when pruning fails', async () => {
    const messages = new CountingRepository();
    messages.failNext = true;
    const retention = new ChatHistoryRetention(messages);

    await retention.recordInsert();
    await retention.recordInsert();

    expect(messages.prunes).toBe(2);
  });
});
