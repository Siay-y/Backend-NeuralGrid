import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isAccessTokenClaims } from '../../application/dtos/access-token-payload';
import { InvalidSessionError } from '../../application/errors/invalid-session.error';
import {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from '../../application/ports/access-token-verifier';

@Injectable()
export class JwtAccessTokenVerifier extends AccessTokenVerifier {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  async verify(token: string): Promise<VerifiedAccessToken> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new InvalidSessionError();
    }

    if (!isAccessTokenClaims(payload) || typeof payload.exp !== 'number') {
      throw new InvalidSessionError();
    }

    return {
      claims: {
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      },
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}
