import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../../../users/domain/value-objects/user-role';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { getRequestUser } from '../request-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!allowedRoles?.length) {
      return true;
    }

    const user = getRequestUser(context);
    if (!user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Seu papel na mesa não permite esta ação');
    }
    return true;
  }
}
