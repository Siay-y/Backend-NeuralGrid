import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidSheetError extends DomainError {
  readonly code = 'INVALID_SHEET';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
