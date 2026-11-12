import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class MapNotFoundError extends DomainError {
  readonly code = 'MAP_NOT_FOUND';
  readonly category = 'not_found';

  constructor(subject: 'map' | 'area' = 'map') {
    super(
      subject === 'map'
        ? 'Mapa não encontrado. Ele pode ter sido apagado'
        : 'Área não encontrada. Ela pode ter sido apagada',
    );
  }
}
