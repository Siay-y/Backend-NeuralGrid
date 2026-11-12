import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class MapForbiddenError extends DomainError {
  readonly code = 'MAP_FORBIDDEN';
  readonly category = 'forbidden';

  constructor() {
    super('Só o mestre gerencia os mapas da mesa');
  }
}
