import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidUsernameError extends DomainError {
  readonly code = 'INVALID_USERNAME';
  readonly category = 'invalid';

  constructor(raw: string) {
    super(
      `Usuário "${raw}" inválido: use de 3 a 32 caracteres entre letras minúsculas, números, ponto, hífen e sublinhado`,
    );
  }
}
