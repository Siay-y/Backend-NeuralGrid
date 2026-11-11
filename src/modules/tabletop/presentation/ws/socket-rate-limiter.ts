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
    this.refill();
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }

  retryAfterMs(): number {
    this.refill();
    if (this.tokens >= 1) {
      return 0;
    }
    return Math.ceil(
      ((1 - this.tokens) / this.settings.refillPerSecond) * 1000,
    );
  }

  private refill(): void {
    const current = this.now();
    const elapsedSeconds = (current - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.settings.capacity,
      this.tokens + elapsedSeconds * this.settings.refillPerSecond,
    );
    this.lastRefill = current;
  }
}
