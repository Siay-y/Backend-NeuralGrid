import { InvalidUsernameError } from '../errors/invalid-username.error';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export class Username {
  private constructor(readonly value: string) {}

  static create(raw: string): Username {
    const normalized = normalizeUsername(raw);
    if (!USERNAME_PATTERN.test(normalized)) {
      throw new InvalidUsernameError(raw);
    }
    return new Username(normalized);
  }
}
