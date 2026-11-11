import type { ExecutionContext } from '@nestjs/common';
import { minutes, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { isBruteForceProtected } from './brute-force.decorator';

const skipUnlessBruteForceProtected = (context: ExecutionContext): boolean =>
  !isBruteForceProtected(context);

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
    ],
  };
}
