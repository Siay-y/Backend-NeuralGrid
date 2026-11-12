import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class CombatForbiddenError extends DomainError {
  readonly code = 'COMBAT_FORBIDDEN';
  readonly category = 'forbidden';

  constructor(reason = 'Só o mestre conduz o combate') {
    super(reason);
  }
}
