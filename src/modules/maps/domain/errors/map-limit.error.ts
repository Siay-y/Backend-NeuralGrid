import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class MapLimitError extends DomainError {
  readonly code = 'MAP_LIMIT';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}
