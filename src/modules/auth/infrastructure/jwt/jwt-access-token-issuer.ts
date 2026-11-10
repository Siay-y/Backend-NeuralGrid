import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { durationToSeconds } from '../../../../core/config/duration';
import { EnvService } from '../../../../core/config/env.service';
import type { AccessTokenClaims } from '../../application/dtos/access-token-payload';
import {
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../../application/ports/access-token-issuer';

@Injectable()
export class JwtAccessTokenIssuer extends AccessTokenIssuer {
  private readonly expiresIn: number;

  constructor(
    private readonly jwt: JwtService,
    env: EnvService,
  ) {
    super();
    this.expiresIn = durationToSeconds(env.get('JWT_EXPIRES_IN'));
  }

  async issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    const token = await this.jwt.signAsync(
      { username: claims.username, role: claims.role },
      { subject: claims.sub, expiresIn: this.expiresIn },
    );
    return { token, expiresIn: this.expiresIn };
  }
}
