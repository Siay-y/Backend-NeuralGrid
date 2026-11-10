import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidTokenError extends DomainError {
  readonly code = 'INVALID_TOKEN';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
