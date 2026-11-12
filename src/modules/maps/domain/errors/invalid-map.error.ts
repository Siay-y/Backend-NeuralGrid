import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidMapError extends DomainError {
  readonly code = 'INVALID_MAP';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
