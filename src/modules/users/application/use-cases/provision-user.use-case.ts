import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { User } from '../../domain/entities/user';
import { InvalidUserProfileError } from '../../domain/errors/invalid-user-profile.error';
import { UserRepository } from '../../domain/repositories/user.repository';
import type { UserRole } from '../../domain/value-objects/user-role';
import { Username } from '../../domain/value-objects/username';
import { PasswordHasher } from '../ports/password-hasher';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export interface ProvisionUserInput {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
  resetPassword: boolean;
}

export type ProvisionOutcome = 'created' | 'updated' | 'unchanged';

@Injectable()
export class ProvisionUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: ProvisionUserInput): Promise<ProvisionOutcome> {
    const username = Username.create(input.username);
    const existing = await this.users.findByUsername(username.value);

    if (existing && !input.resetPassword) {
      return 'unchanged';
    }

    assertPasswordPolicy(input.password);
    const passwordHash = await this.hasher.hash(input.password);
    const now = new Date();

    const user = existing
      ? existing
          .withProfile(input.displayName, input.role, now)
          .withPasswordHash(passwordHash, now)
      : User.create({
          id: randomUUID(),
          username,
          displayName: input.displayName,
          role: input.role,
          passwordHash,
          now,
        });

    await this.users.save(user);
    return existing ? 'updated' : 'created';
  }
}

function assertPasswordPolicy(password: string): void {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new InvalidUserProfileError(
      `A senha precisa ter entre ${PASSWORD_MIN_LENGTH} e ${PASSWORD_MAX_LENGTH} caracteres`,
    );
  }
}
