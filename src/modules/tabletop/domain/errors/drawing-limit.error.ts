import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class DrawingLimitError extends DomainError {
  readonly code = 'DRAWING_LIMIT';
  readonly category = 'invalid';

  constructor(limit: number) {
    super(
      `A mesa chegou a ${limit} desenhos. Apague alguns para desenhar de novo`,
    );
  }
}
