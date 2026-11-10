import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidUserProfileError extends DomainError {
  readonly code = 'INVALID_USER_PROFILE';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
