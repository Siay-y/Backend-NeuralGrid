import {
  isUserRole,
  type UserRole,
} from '../../../users/domain/value-objects/user-role';

export interface AccessTokenClaims {
  sub: string;
  username: string;
  role: UserRole;
}

export function isAccessTokenClaims(
  value: unknown,
): value is AccessTokenClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sub === 'string' &&
    typeof candidate.username === 'string' &&
    isUserRole(candidate.role)
  );
}
