import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../application/dtos/auth-session';

interface HttpCarrier {
  user?: AuthenticatedUser;
}

interface SocketCarrier {
  data?: { user?: AuthenticatedUser };
}

export function getRequestUser(
  context: ExecutionContext,
): AuthenticatedUser | undefined {
  switch (context.getType()) {
    case 'http':
      return context.switchToHttp().getRequest<HttpCarrier>().user;
    case 'ws':
      return context.switchToWs().getClient<SocketCarrier>().data?.user;
    default:
      return undefined;
  }
}
