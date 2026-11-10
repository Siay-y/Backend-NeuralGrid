import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { normalizeUsername } from '../../domain/value-objects/username';
import { UserRepository } from '../../domain/repositories/user.repository';
import { toUserView, UserView } from '../dtos/user-view';
import { PasswordHasher } from '../ports/password-hasher';

export interface CredentialsInput {
  username: string;
  password: string;
}

@Injectable()
export class VerifyCredentialsUseCase {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: CredentialsInput): Promise<UserView | null> {
    const user = await this.users.findByUsername(
      normalizeUsername(input.username),
    );

    // An unknown username still pays for a full hash verification, so response
    // time does not reveal which usernames exist.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const matches = await this.hasher.verify(hash, input.password);

    return user && matches ? toUserView(user) : null;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(randomBytes(32).toString('hex'));
    return this.dummyHash;
  }
}
