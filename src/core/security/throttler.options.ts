import type { ExecutionContext } from '@nestjs/common';
import { minutes, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { isBruteForceProtected } from './brute-force.decorator';

const skipUnlessBruteForceProtected = (context: ExecutionContext): boolean =>
  !isBruteForceProtected(context);

// Credential attempts are limited twice: per IP stops a single source hammering
// the endpoint, per account stops a distributed attack against one username.
// The account key is read from the raw body because guards run before pipes.
function trackAccount(request: Record<string, any>): string {
  const body = request.body as Record<string, unknown> | undefined;
  const username = body?.username;
  if (typeof username === 'string' && username.trim().length > 0) {
    return `account:${username.trim().toLowerCase().slice(0, 64)}`;
  }
  return `ip:${String(request.ip)}`;
}

export function buildThrottlerOptions(): ThrottlerModuleOptions {
  return {
    setHeaders: false,
    throttlers: [
      { name: 'default', ttl: minutes(1), limit: 120 },
      {
        name: 'login-ip',
        ttl: minutes(10),
        limit: 10,
        blockDuration: minutes(15),
        skipIf: skipUnlessBruteForceProtected,
      },
      {
        name: 'login-account',
        ttl: minutes(15),
        limit: 5,
        blockDuration: minutes(15),
        skipIf: skipUnlessBruteForceProtected,
        getTracker: trackAccount,
      },
    ],
  };
}
