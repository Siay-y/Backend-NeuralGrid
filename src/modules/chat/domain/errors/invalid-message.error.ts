import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidMessageError extends DomainError {
  readonly code = 'INVALID_MESSAGE';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
