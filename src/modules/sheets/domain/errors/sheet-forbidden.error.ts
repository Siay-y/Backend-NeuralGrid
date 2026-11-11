import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class SheetForbiddenError extends DomainError {
  readonly code = 'SHEET_FORBIDDEN';
  readonly category = 'forbidden';

  constructor(reason: string) {
    super(reason);
  }
}
