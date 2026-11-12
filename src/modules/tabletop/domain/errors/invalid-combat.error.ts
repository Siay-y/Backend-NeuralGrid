import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidCombatError extends DomainError {
  readonly code = 'INVALID_COMBAT';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
