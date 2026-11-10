import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../../application/dtos/auth-session';
import { getRequestUser } from '../request-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = getRequestUser(context);
    if (!user) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
    return user;
  },
);
