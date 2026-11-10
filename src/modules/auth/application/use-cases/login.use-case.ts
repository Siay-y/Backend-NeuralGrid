import { Injectable } from '@nestjs/common';
import {
  CredentialsInput,
  VerifyCredentialsUseCase,
} from '../../../users/application/use-cases/verify-credentials.use-case';
import type { AuthSession } from '../dtos/auth-session';
import { InvalidCredentialsError } from '../errors/invalid-credentials.error';
import { AccessTokenIssuer } from '../ports/access-token-issuer';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly verifyCredentials: VerifyCredentialsUseCase,
    private readonly tokens: AccessTokenIssuer,
  ) {}

  async execute(input: CredentialsInput): Promise<AuthSession> {
    const user = await this.verifyCredentials.execute(input);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const { token, expiresIn } = await this.tokens.issue({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return { accessToken: token, tokenType: 'Bearer', expiresIn, user };
  }
}
