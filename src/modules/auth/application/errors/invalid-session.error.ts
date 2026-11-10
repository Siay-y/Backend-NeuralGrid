import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidSessionError extends DomainError {
  readonly code = 'INVALID_SESSION';
  readonly category = 'unauthorized';

  constructor() {
    super('Sessão inválida ou expirada');
  }
}
