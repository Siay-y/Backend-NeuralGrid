import { ExecutionContext, SetMetadata } from '@nestjs/common';

const BRUTE_FORCE_PROTECTED_KEY = 'security:brute-force-protected';

export const BruteForceProtected = (): MethodDecorator =>
  SetMetadata(BRUTE_FORCE_PROTECTED_KEY, true);

export function isBruteForceProtected(context: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(BRUTE_FORCE_PROTECTED_KEY, context.getHandler()) ===
    true
  );
}
