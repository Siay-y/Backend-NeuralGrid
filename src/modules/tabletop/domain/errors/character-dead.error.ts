import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class CharacterDeadError extends DomainError {
  readonly code = 'CHARACTER_DEAD';
  readonly category = 'forbidden';

  constructor() {
    super('Seu personagem está morto');
  }
}
