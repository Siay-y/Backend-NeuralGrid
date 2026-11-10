import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { EnvService } from '../../../../../core/config/env.service';
import { isAccessTokenClaims } from '../../../application/dtos/access-token-payload';
import type { AuthenticatedUser } from '../../../application/dtos/auth-session';
import { ResolveSessionUserUseCase } from '../../../application/use-cases/resolve-session-user.use-case';

export const JWT_STRATEGY = 'jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
  constructor(
    env: EnvService,
    private readonly resolveSessionUser: ResolveSessionUserUseCase,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.get('JWT_SECRET'),
      algorithms: ['HS256'],
      issuer: env.get('JWT_ISSUER'),
      audience: env.get('JWT_AUDIENCE'),
      ignoreExpiration: false,
    });
  }

  validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isAccessTokenClaims(payload)) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
    return this.resolveSessionUser.execute(payload);
  }
}
