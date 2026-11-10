import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly category = 'unauthorized';

  constructor() {
    super('Usuário ou senha inválidos');
  }
}
