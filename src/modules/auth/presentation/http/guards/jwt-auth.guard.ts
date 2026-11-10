import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import { IS_PUBLIC_KEY } from '../../../../../shared/presentation/http/decorators/public.decorator';
import { getRequestUser } from '../request-user';
import { JWT_STRATEGY } from '../strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Sockets authenticate once, during the handshake, and carry the resolved
    // user afterwards. Any other transport is refused instead of let through.
    switch (context.getType()) {
      case 'http':
        return super.canActivate(context);
      case 'ws':
        if (!getRequestUser(context)) {
          throw new WsException('Sessão inválida ou expirada');
        }
        return true;
      default:
        return false;
    }
  }

  handleRequest<TUser>(error: unknown, user: TUser | false): TUser {
    if (error || !user) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
    return user;
  }
}
