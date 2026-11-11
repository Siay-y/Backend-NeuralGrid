import {
  type RateLimitSettings,
  SocketRateLimiter,
} from './socket-rate-limiter';

export type CooldownAction = 'chat' | 'dice';

export const COOLDOWN_RULES: Readonly<
  Record<CooldownAction, RateLimitSettings>
> = {
  chat: { capacity: 4, refillPerSecond: 0.5 },
  dice: { capacity: 4, refillPerSecond: 0.5 },
};

export class ActionCooldowns {
  private readonly buckets = new Map<string, SocketRateLimiter>();

  constructor(
    private readonly rules: Readonly<
      Record<CooldownAction, RateLimitSettings>
    > = COOLDOWN_RULES,
    private readonly now: () => number = Date.now,
  ) {}

  take(userId: string, action: CooldownAction): number {
    const key = `${action}:${userId}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new SocketRateLimiter(this.rules[action], this.now);
      this.buckets.set(key, bucket);
    }
    return bucket.tryConsume() ? 0 : bucket.retryAfterMs();
  }
}
