import { Injectable } from '@nestjs/common';
import { parseDiceFormula } from '../../../chat/domain/dice/dice-formula';
import type { Token } from '../../domain/entities/token';
import { StatusForbiddenError } from '../../domain/errors/status-forbidden.error';
import { TokenNotFoundError } from '../../domain/errors/token-not-found.error';
import type { TableActor } from '../../domain/policies/token-policy';
import { TokenRepository } from '../../domain/repositories/token.repository';
import { TokenStatusRepository } from '../../domain/repositories/token-status.repository';
import {
  applyStatus,
  deathFor,
  removeStatus,
  STATUS_AMOUNT,
  type StatusKind,
  tokenStatus,
  type TokenStatus,
} from '../../domain/value-objects/token-status';
import {
  type StatusChange,
  statusesFor,
  type TokenStatusesView,
} from '../dtos/status-view';

const FLAT = /^\d{1,3}$/;

export interface ApplyStatusInput {
  tokenId: string;
  kind: StatusKind;
  turns: number | null;
  amount: string | null;
  immuneTo: readonly string[];
}

type StatusEdit = (
  statuses: TokenStatus[],
  token: Token,
) => TokenStatus[] | Promise<TokenStatus[]>;

function assertApplies(actor: TableActor): void {
  if (actor.role !== 'master') {
    throw new StatusForbiddenError();
  }
}

@Injectable()
export class StatusBook {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly statuses: TokenStatusRepository,
    private readonly tokens: TokenRepository,
  ) {}

  async list(actor: TableActor): Promise<TokenStatusesView[]> {
    const [statuses, tokens] = await Promise.all([
      this.statuses.findAll(),
      this.tokens.findAll(),
    ]);
    return statusesFor(actor, statuses, tokens);
  }

  of(tokenId: string): Promise<TokenStatus[]> {
    return this.statuses.findByToken(tokenId);
  }

  edit(tokenId: string, apply: StatusEdit): Promise<StatusChange> {
    return this.serialize(async () => {
      const token = await this.tokens.findById(tokenId);
      if (!token) {
        throw new TokenNotFoundError();
      }
      const current = await this.statuses.findByToken(tokenId);
      const next = await apply(current, token);
      if (next !== current) {
        await this.statuses.replace(tokenId, next);
      }
      return { tokenId, statuses: next, hidden: token.hidden };
    });
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}

@Injectable()
export class ListStatusesUseCase {
  constructor(private readonly book: StatusBook) {}

  execute(actor: TableActor): Promise<TokenStatusesView[]> {
    return this.book.list(actor);
  }

  ofToken(tokenId: string): Promise<TokenStatus[]> {
    return this.book.of(tokenId);
  }
}

@Injectable()
export class ApplyStatusUseCase {
  constructor(private readonly book: StatusBook) {}

  async execute(
    actor: TableActor,
    input: ApplyStatusInput,
  ): Promise<StatusChange> {
    assertApplies(actor);
    return this.book.edit(input.tokenId, (statuses, token) => {
      const status = deathFor(token.kind, tokenStatus(input));
      const flat =
        STATUS_AMOUNT[status.kind] === 'value' &&
        FLAT.test(status.amount ?? '');
      if (status.amount !== null && !flat) {
        parseDiceFormula(status.amount);
      }
      return applyStatus(statuses, status);
    });
  }
}

@Injectable()
export class RemoveStatusUseCase {
  constructor(private readonly book: StatusBook) {}

  async execute(
    actor: TableActor,
    tokenId: string,
    kind: StatusKind,
  ): Promise<StatusChange> {
    assertApplies(actor);
    return this.book.edit(tokenId, (statuses) => removeStatus(statuses, kind));
  }
}
