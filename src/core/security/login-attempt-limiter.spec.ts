import {
  LOGIN_ACCOUNT_ALERT,
  LOGIN_FAILURE_WINDOW_MS,
  LoginAttemptLimiter,
} from './login-attempt-limiter';

class ClockedLimiter extends LoginAttemptLimiter {
  at = 1_000_000;

  protected now(): number {
    return this.at;
  }
}

const failMany = (
  limiter: LoginAttemptLimiter,
  account: string,
  addresses: string[],
): void => {
  for (const address of addresses) {
    limiter.recordFailure(account, address);
  }
};

describe('LoginAttemptLimiter', () => {
  it('never counts successful sign ins', () => {
    const limiter = new ClockedLimiter();
    for (let tab = 0; tab < 20; tab++) {
      expect(limiter.check('ana', '10.0.0.1')).toBeNull();
      limiter.recordSuccess('ana', '10.0.0.1');
    }
  });

  it('holds back an address after repeated failures on one account', () => {
    const limiter = new ClockedLimiter();
    failMany(limiter, 'ana', Array(LOGIN_ACCOUNT_ALERT).fill('10.0.0.9'));

    const block = limiter.check('ana', '10.0.0.9');
    expect(block?.retryAfterSeconds).toBe(LOGIN_FAILURE_WINDOW_MS / 1000);
    expect(limiter.check('mestre', '10.0.0.9')).toBeNull();
  });

  it('keeps the owner signing in while a stranger attacks the account', () => {
    const limiter = new ClockedLimiter();
    failMany(
      limiter,
      'mestre',
      Array(LOGIN_ACCOUNT_ALERT).fill('198.51.100.7'),
    );

    expect(limiter.check('mestre', '198.51.100.7')).not.toBeNull();
    expect(limiter.check('mestre', '203.0.113.5')).toBeNull();
  });

  it('gives a distributed attack one guess per address', () => {
    const limiter = new ClockedLimiter();
    const bots = Array.from(
      { length: LOGIN_ACCOUNT_ALERT },
      (_, i) => `198.51.100.${i}`,
    );
    for (const bot of bots) {
      expect(limiter.check('mestre', bot)).toBeNull();
    }
    failMany(limiter, 'mestre', bots);

    expect(bots.every((bot) => limiter.check('mestre', bot) !== null)).toBe(
      true,
    );
    expect(limiter.check('mestre', '198.51.100.200')).toBeNull();
  });

  it('forgets failures once the window passes', () => {
    const limiter = new ClockedLimiter();
    failMany(limiter, 'ana', Array(LOGIN_ACCOUNT_ALERT).fill('10.0.0.9'));
    limiter.at += LOGIN_FAILURE_WINDOW_MS + 1;

    expect(limiter.check('ana', '10.0.0.9')).toBeNull();
  });

  it('clears an address after it signs in correctly', () => {
    const limiter = new ClockedLimiter();
    failMany(limiter, 'ana', Array(LOGIN_ACCOUNT_ALERT - 1).fill('10.0.0.1'));
    limiter.recordSuccess('ana', '10.0.0.1');
    limiter.recordFailure('ana', '10.0.0.1');

    expect(limiter.check('ana', '10.0.0.1')).toBeNull();
  });
});
