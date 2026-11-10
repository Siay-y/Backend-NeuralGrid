export interface RateLimitSettings {
  capacity: number;
  refillPerSecond: number;
}

export class SocketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly settings: RateLimitSettings,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = settings.capacity;
    this.lastRefill = now();
  }

  tryConsume(): boolean {
    const current = this.now();
    const elapsedSeconds = (current - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.settings.capacity,
      this.tokens + elapsedSeconds * this.settings.refillPerSecond,
    );
    this.lastRefill = current;

    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }
}
