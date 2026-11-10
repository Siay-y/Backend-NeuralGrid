import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { BruteForceProtected } from '../../../../../core/security/brute-force.decorator';
import { Public } from '../../../../../shared/presentation/http/decorators/public.decorator';
import type {
  AuthenticatedUser,
  AuthSession,
} from '../../../application/dtos/auth-session';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { LoginRequestDto } from '../dtos/login-request.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Public()
  @BruteForceProtected()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  login(@Body() body: LoginRequestDto): Promise<AuthSession> {
    return this.loginUseCase.execute(body);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
