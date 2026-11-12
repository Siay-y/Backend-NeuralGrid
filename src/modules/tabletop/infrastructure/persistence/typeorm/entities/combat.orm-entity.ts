import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface CombatantRecord {
  tokenId: string;
  initiative: number | null;
  hidden: boolean;
}

@Entity({ name: 'combat' })
@Check('ck_combat_single_row', `"id" = 1`)
export class CombatOrmEntity {
  @PrimaryColumn({ type: 'smallint', primaryKeyConstraintName: 'pk_combat' })
  id: number;

  @Column({ type: 'integer', default: 0 })
  round: number;

  @Column({ name: 'turn_token_id', type: 'uuid', nullable: true })
  turnTokenId: string | null;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  combatants: CombatantRecord[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
