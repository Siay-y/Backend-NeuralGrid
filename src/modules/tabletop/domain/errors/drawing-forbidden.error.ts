import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class DrawingForbiddenError extends DomainError {
  readonly code = 'DRAWING_FORBIDDEN';
  readonly category = 'forbidden';

  constructor(reason: string) {
    super(reason);
  }
}
