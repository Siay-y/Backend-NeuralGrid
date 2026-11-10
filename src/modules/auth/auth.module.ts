import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { EnvService } from '../../core/config/env.service';
import { UsersModule } from '../users/users.module';
import { AccessTokenIssuer } from './application/ports/access-token-issuer';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { ResolveSessionUserUseCase } from './application/use-cases/resolve-session-user.use-case';
import { JwtAccessTokenIssuer } from './infrastructure/jwt/jwt-access-token-issuer';
import { AuthController } from './presentation/http/controllers/auth.controller';
import { JwtStrategy } from './presentation/http/strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        secret: env.get('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          issuer: env.get('JWT_ISSUER'),
          audience: env.get('JWT_AUDIENCE'),
        },
        verifyOptions: {
          algorithms: ['HS256'],
          issuer: env.get('JWT_ISSUER'),
          audience: env.get('JWT_AUDIENCE'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AccessTokenIssuer, useClass: JwtAccessTokenIssuer },
    LoginUseCase,
    ResolveSessionUserUseCase,
    JwtStrategy,
  ],
  exports: [ResolveSessionUserUseCase, JwtModule],
})
export class AuthModule {}
