import { SocketRateLimiter } from './socket-rate-limiter';

describe('SocketRateLimiter', () => {
  it('allows a burst up to capacity and then refuses', () => {
    let now = 0;
    const limiter = new SocketRateLimiter(
      { capacity: 3, refillPerSecond: 1 },
      () => now,
    );

    expect([1, 2, 3, 4].map(() => limiter.tryConsume())).toEqual([
      true,
      true,
      true,
      false,
    ]);

    now = 1000;
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it('never refills beyond capacity', () => {
    let now = 0;
    const limiter = new SocketRateLimiter(
      { capacity: 2, refillPerSecond: 10 },
      () => now,
    );

    now = 60_000;

    expect([1, 2, 3].map(() => limiter.tryConsume())).toEqual([
      true,
      true,
      false,
    ]);
  });
});
