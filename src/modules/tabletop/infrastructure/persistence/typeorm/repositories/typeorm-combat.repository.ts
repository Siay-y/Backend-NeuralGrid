import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import {
  type Combat,
  type Combatant,
  IDLE_COMBAT,
} from '../../../../domain/entities/combat';
import { CombatRepository } from '../../../../domain/repositories/combat.repository';
import { CombatOrmEntity } from '../entities/combat.orm-entity';

const COMBAT_ID = 1;

function toCombatant(record: unknown): Combatant | null {
  if (typeof record !== 'object' || record === null) {
    return null;
  }
  const { tokenId, initiative, hidden } = record as Record<string, unknown>;
  if (typeof tokenId !== 'string') {
    return null;
  }
  return {
    tokenId,
    initiative: Number.isInteger(initiative) ? (initiative as number) : null,
    hidden: hidden === true,
  };
}

@Injectable()
export class TypeOrmCombatRepository extends CombatRepository {
  constructor(
    @InjectRepository(CombatOrmEntity)
    private readonly rows: Repository<CombatOrmEntity>,
  ) {
    super();
  }

  async get(): Promise<Combat> {
    const row = await this.rows.findOneBy({ id: COMBAT_ID });
    if (!row) {
      return IDLE_COMBAT;
    }
    const combatants = (Array.isArray(row.combatants) ? row.combatants : [])
      .map(toCombatant)
      .filter((combatant): combatant is Combatant => combatant !== null);
    return { round: row.round, turnId: row.turnTokenId, combatants };
  }

  async save(combat: Combat): Promise<void> {
    await this.rows.upsert(
      {
        id: COMBAT_ID,
        round: combat.round,
        turnTokenId: combat.turnId,
        combatants: combat.combatants.map(
          ({ tokenId, initiative, hidden }) => ({
            tokenId,
            initiative,
            hidden,
          }),
        ),
      },
      ['id'],
    );
  }
}
