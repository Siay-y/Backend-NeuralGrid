import { Injectable } from '@nestjs/common';
import { GetUserByIdUseCase } from '../../../users/application/use-cases/get-user-by-id.use-case';
import type { AccessTokenClaims } from '../dtos/access-token-payload';
import type { AuthenticatedUser } from '../dtos/auth-session';
import { InvalidSessionError } from '../errors/invalid-session.error';

@Injectable()
export class ResolveSessionUserUseCase {
  constructor(private readonly getUserById: GetUserByIdUseCase) {}

  async execute(claims: AccessTokenClaims): Promise<AuthenticatedUser> {
    const user = await this.getUserById.execute(claims.sub);

    // A signed token is only as trustworthy as the account behind it: removing a
    // user or changing their role invalidates every token issued before that.
    if (
      !user ||
      user.username !== claims.username ||
      user.role !== claims.role
    ) {
      throw new InvalidSessionError();
    }

    return user;
  }
}
