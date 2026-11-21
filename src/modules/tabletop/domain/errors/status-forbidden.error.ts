import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class StatusForbiddenError extends DomainError {
  readonly code = 'STATUS_FORBIDDEN';
  readonly category = 'forbidden';

  constructor() {
    super('Só o mestre aplica status');
  }
}
