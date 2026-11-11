import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidPayloadError extends DomainError {
  readonly code = 'INVALID_PAYLOAD';
  readonly category = 'invalid';

  constructor(reason: string) {
    super(reason);
  }
}

export class RateLimitedError extends DomainError {
  readonly code = 'RATE_LIMITED';
  readonly category = 'invalid';

  constructor() {
    super('Ações rápidas demais. Aguarde um instante');
  }
}

export class CooldownError extends DomainError {
  readonly code = 'COOLDOWN';
  readonly category = 'invalid';

  constructor(readonly retryAfterMs: number) {
    super(
      `Muitos envios seguidos. Aguarde ${Math.ceil(retryAfterMs / 1000)} s para enviar de novo`,
    );
  }
}

export interface WsError {
  code: string;
  message: string;
  retryAfterMs?: number;
}

export type WsResult<T> = { ok: true; data: T } | { ok: false; error: WsError };

export async function parsePayload<T extends object>(
  dto: new () => T,
  raw: unknown,
): Promise<T> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidPayloadError('Envie um objeto JSON');
  }

  const instance = plainToInstance(dto, raw);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });

  if (errors.length > 0) {
    const [first] = errors;
    const reason = Object.values(first.constraints ?? {})[0];
    throw new InvalidPayloadError(
      reason ?? `Campo inválido: ${first.property}`,
    );
  }
  return instance;
}
