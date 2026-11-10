import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../dtos/auth-session';
import { InvalidSessionError } from '../errors/invalid-session.error';
import { AccessTokenVerifier } from '../ports/access-token-verifier';
import { ResolveSessionUserUseCase } from './resolve-session-user.use-case';

export interface AuthenticatedAccess {
  user: AuthenticatedUser;
  expiresAt: Date;
}

@Injectable()
export class AuthenticateAccessTokenUseCase {
  constructor(
    private readonly verifier: AccessTokenVerifier,
    private readonly resolveSessionUser: ResolveSessionUserUseCase,
  ) {}

  async execute(token: unknown): Promise<AuthenticatedAccess> {
    if (typeof token !== 'string' || token.length === 0) {
      throw new InvalidSessionError();
    }

    const { claims, expiresAt } = await this.verifier.verify(token);
    const user = await this.resolveSessionUser.execute(claims);
    return { user, expiresAt };
  }
}
