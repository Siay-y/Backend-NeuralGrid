import type { UserRole } from '../../../users/domain/value-objects/user-role';
import type { Token } from '../entities/token';
import { TokenForbiddenError } from '../errors/token-forbidden.error';

export interface TableActor {
  id: string;
  role: UserRole;
}

export const TokenPolicy = {
  canManage(actor: TableActor): boolean {
    return actor.role === 'master';
  },

  canSee(actor: TableActor, token: Token): boolean {
    return actor.role === 'master' || !token.hidden;
  },

  canMove(actor: TableActor, token: Token): boolean {
    return (
      actor.role === 'master' || (!token.hidden && token.isOwnedBy(actor.id))
    );
  },

  assertCanManage(actor: TableActor): void {
    if (!TokenPolicy.canManage(actor)) {
      throw new TokenForbiddenError(
        'Só o mestre pode criar, editar ou remover tokens',
      );
    }
  },

  assertCanMove(actor: TableActor, token: Token): void {
    if (!TokenPolicy.canMove(actor, token)) {
      throw new TokenForbiddenError(
        'Você só pode mover os seus próprios tokens',
      );
    }
  },
};
