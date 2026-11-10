import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class ChatForbiddenError extends DomainError {
  readonly code = 'CHAT_FORBIDDEN';
  readonly category = 'forbidden';

  constructor(reason: string) {
    super(reason);
  }
}
