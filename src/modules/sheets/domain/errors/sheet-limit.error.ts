import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class SheetLimitError extends DomainError {
  readonly code = 'SHEET_LIMIT';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
