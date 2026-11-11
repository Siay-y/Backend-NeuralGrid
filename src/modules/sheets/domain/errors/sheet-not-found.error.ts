import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class SheetNotFoundError extends DomainError {
  readonly code = 'SHEET_NOT_FOUND';
  readonly category = 'not_found';

  constructor() {
    super('Ficha não encontrada. Ela pode ter sido apagada');
  }
}
