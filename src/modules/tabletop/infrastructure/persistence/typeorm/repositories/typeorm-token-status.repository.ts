import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TokenStatusRepository } from '../../../../domain/repositories/token-status.repository';
import {
  DEBUFF_KINDS,
  isStatusKind,
  sortStatuses,
  type TokenStatus,
} from '../../../../domain/value-objects/token-status';
import { TokenStatusOrmEntity } from '../entities/token-status.orm-entity';

function toStatus(row: TokenStatusOrmEntity): TokenStatus | null {
  if (!isStatusKind(row.kind)) {
    return null;
  }
  const immuneTo: readonly unknown[] = Array.isArray(row.immuneTo)
    ? row.immuneTo
    : [];
  return {
    kind: row.kind,
    turns: row.turns,
    amount: row.amount,
    immuneTo: DEBUFF_KINDS.filter((kind) => immuneTo.includes(kind)),
  };
}

function statusesOf(rows: readonly TokenStatusOrmEntity[]): TokenStatus[] {
  return sortStatuses(
    rows
      .map(toStatus)
      .filter((status): status is TokenStatus => status !== null),
  );
}

@Injectable()
export class TypeOrmTokenStatusRepository extends TokenStatusRepository {
  constructor(
    @InjectRepository(TokenStatusOrmEntity)
    private readonly rows: Repository<TokenStatusOrmEntity>,
  ) {
    super();
  }

  async findAll(): Promise<Map<string, TokenStatus[]>> {
    const rows = await this.rows.find();
    const grouped = new Map<string, TokenStatusOrmEntity[]>();
    for (const row of rows) {
      grouped.set(row.tokenId, [...(grouped.get(row.tokenId) ?? []), row]);
    }
    return new Map(
      [...grouped].map(([tokenId, group]) => [tokenId, statusesOf(group)]),
    );
  }

  async findByToken(tokenId: string): Promise<TokenStatus[]> {
    return statusesOf(await this.rows.findBy({ tokenId }));
  }

  async replace(
    tokenId: string,
    statuses: readonly TokenStatus[],
  ): Promise<void> {
    await this.rows.manager.transaction(async (manager) => {
      const rows = manager.getRepository(TokenStatusOrmEntity);
      const kinds = statuses.map(({ kind }) => kind);
      const stale = (await rows.findBy({ tokenId })).filter(
        (row) => !kinds.includes(row.kind),
      );
      if (stale.length > 0) {
        await rows.remove(stale);
      }
      if (statuses.length > 0) {
        await rows.upsert(
          statuses.map((status) => ({
            tokenId,
            kind: status.kind,
            turns: status.turns,
            amount: status.amount,
            immuneTo: status.immuneTo,
          })),
          ['tokenId', 'kind'],
        );
      }
    });
  }
}
