import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidStatusError extends DomainError {
  readonly code = 'INVALID_STATUS';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
