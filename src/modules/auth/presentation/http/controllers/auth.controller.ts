import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { BruteForceProtected } from '../../../../../core/security/brute-force.decorator';
import { LoginAttemptLimiter } from '../../../../../core/security/login-attempt-limiter';
import { Public } from '../../../../../shared/presentation/http/decorators/public.decorator';
import type {
  AuthenticatedUser,
  AuthSession,
} from '../../../application/dtos/auth-session';
import { InvalidCredentialsError } from '../../../application/errors/invalid-credentials.error';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { LoginRequestDto } from '../dtos/login-request.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly attempts: LoginAttemptLimiter,
  ) {}

  @Public()
  @BruteForceProtected()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const address = String(request.ip);
    const blocked = this.attempts.check(body.username, address);
    if (blocked) {
      response.setHeader('Retry-After', String(blocked.retryAfterSeconds));
      throw new ThrottlerException(
        'Muitas tentativas. Aguarde antes de tentar novamente',
      );
    }

    try {
      const session = await this.loginUseCase.execute(body);
      this.attempts.recordSuccess(body.username, address);
      return session;
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        this.attempts.recordFailure(body.username, address);
      }
      throw error;
    }
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
