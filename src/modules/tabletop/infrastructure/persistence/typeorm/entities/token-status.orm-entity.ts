import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import {
  type DebuffKind,
  STATUS_KINDS,
  type StatusKind,
} from '../../../../domain/value-objects/token-status';
import { TokenOrmEntity } from './token.orm-entity';

@Entity({ name: 'token_statuses' })
@Check('ck_token_statuses_turns', `"turns" IS NULL OR "turns" BETWEEN 1 AND 99`)
export class TokenStatusOrmEntity {
  @PrimaryColumn({
    name: 'token_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_token_statuses',
  })
  tokenId: string;

  @PrimaryColumn({
    type: 'enum',
    enum: STATUS_KINDS,
    enumName: 'token_status_kind',
    primaryKeyConstraintName: 'pk_token_statuses',
  })
  kind: StatusKind;

  @ManyToOne(() => TokenOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'token_id',
    foreignKeyConstraintName: 'fk_token_statuses_token',
  })
  token?: TokenOrmEntity;

  @Column({ type: 'smallint', nullable: true })
  turns: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  amount: string | null;

  @Column({
    name: 'immune_to',
    type: 'jsonb',
    default: () => `'[]'::jsonb`,
  })
  immuneTo: DebuffKind[];

  @CreateDateColumn({ name: 'applied_at', type: 'timestamptz' })
  appliedAt: Date;
}
