import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidDrawingError extends DomainError {
  readonly code = 'INVALID_DRAWING';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
