import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class TokenNotFoundError extends DomainError {
  readonly code = 'TOKEN_NOT_FOUND';
  readonly category = 'not_found';

  constructor() {
    super('Token não encontrado. Ele pode ter sido removido pelo mestre');
  }
}
