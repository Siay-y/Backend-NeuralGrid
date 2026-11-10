import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class TokenForbiddenError extends DomainError {
  readonly code = 'TOKEN_FORBIDDEN';
  readonly category = 'forbidden';

  constructor(reason: string) {
    super(reason);
  }
}
