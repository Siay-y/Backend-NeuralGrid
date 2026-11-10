import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidDiceExpressionError extends DomainError {
  readonly code = 'INVALID_DICE';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
