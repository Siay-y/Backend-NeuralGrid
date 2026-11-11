import { Injectable } from '@nestjs/common';

export const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;
export const LOGIN_ACCOUNT_ALERT = 5;
const MAX_TRACKED_ACCOUNTS = 10_000;

export interface LoginBlock {
  retryAfterSeconds: number;
}

// Only failed attempts count, and they are scoped to the address that made
// them. Once an account collects LOGIN_ACCOUNT_ALERT failures, every address
// that failed against it is held back, while an address with no failures can
// still sign in. A stranger who knows a username can no longer lock its owner
// out, and a distributed attack gets one guess per address.
@Injectable()
export class LoginAttemptLimiter {
  private readonly failures = new Map<string, Map<string, number[]>>();

  check(account: string, address: string): LoginBlock | null {
    const byAddress = this.prune(account, this.now());
    const own = byAddress?.get(address);
    if (!byAddress || !own) {
      return null;
    }
    let total = 0;
    for (const times of byAddress.values()) {
      total += times.length;
    }
    if (total < LOGIN_ACCOUNT_ALERT) {
      return null;
    }
    const lastFailure = own[own.length - 1];
    return {
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((lastFailure + LOGIN_FAILURE_WINDOW_MS - this.now()) / 1000),
      ),
    };
  }

  recordFailure(account: string, address: string): void {
    const now = this.now();
    const byAddress = this.prune(account, now) ?? new Map<string, number[]>();
    byAddress.set(address, [...(byAddress.get(address) ?? []), now]);
    this.failures.delete(account);
    this.failures.set(account, byAddress);
    if (this.failures.size > MAX_TRACKED_ACCOUNTS) {
      const oldest = this.failures.keys().next().value;
      if (oldest !== undefined) {
        this.failures.delete(oldest);
      }
    }
  }

  recordSuccess(account: string, address: string): void {
    const byAddress = this.failures.get(account);
    byAddress?.delete(address);
    if (byAddress?.size === 0) {
      this.failures.delete(account);
    }
  }

  protected now(): number {
    return Date.now();
  }

  private prune(
    account: string,
    now: number,
  ): Map<string, number[]> | undefined {
    const byAddress = this.failures.get(account);
    if (!byAddress) {
      return undefined;
    }
    for (const [address, times] of byAddress) {
      const kept = times.filter((at) => at > now - LOGIN_FAILURE_WINDOW_MS);
      if (kept.length === 0) {
        byAddress.delete(address);
      } else {
        byAddress.set(address, kept);
      }
    }
    if (byAddress.size === 0) {
      this.failures.delete(account);
      return undefined;
    }
    return byAddress;
  }
}
