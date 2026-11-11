import { ActionCooldowns } from './action-cooldowns';

describe('ActionCooldowns', () => {
  const rules = {
    chat: { capacity: 2, refillPerSecond: 0.5 },
    dice: { capacity: 1, refillPerSecond: 0.5 },
  };

  it('lets a short burst through and then asks to wait', () => {
    let now = 0;
    const cooldowns = new ActionCooldowns(rules, () => now);

    expect(cooldowns.take('ana', 'chat')).toBe(0);
    expect(cooldowns.take('ana', 'chat')).toBe(0);
    expect(cooldowns.take('ana', 'chat')).toBe(2000);

    now = 2000;
    expect(cooldowns.take('ana', 'chat')).toBe(0);
  });

  it('keeps chat, dice and each person apart', () => {
    const cooldowns = new ActionCooldowns(rules, () => 0);

    expect(cooldowns.take('ana', 'dice')).toBe(0);
    expect(cooldowns.take('ana', 'dice')).toBeGreaterThan(0);
    expect(cooldowns.take('ana', 'chat')).toBe(0);
    expect(cooldowns.take('bia', 'dice')).toBe(0);
  });
});
