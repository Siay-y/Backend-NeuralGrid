import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../../../../users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import type { TokenIcon } from '../../../../domain/value-objects/token-icon';
import {
  TOKEN_SEXES,
  type TokenSex,
} from '../../../../domain/value-objects/token-sex';
import {
  TOKEN_KINDS,
  type TokenKind,
} from '../../../../domain/value-objects/token-kind';

@Entity({ name: 'tokens' })
@Check('ck_tokens_label_not_blank', `length(btrim("label")) > 0`)
@Check('ck_tokens_size', `"size" BETWEEN 1 AND 4`)
@Check(
  'ck_tokens_position',
  `"col" BETWEEN -500 AND 500 AND "row" BETWEEN -500 AND 500`,
)
@Check('ck_tokens_version', `"version" >= 1`)
export class TokenOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_tokens' })
  id: string;

  @Column({ type: 'varchar', length: 32 })
  label: string;

  @Column({ type: 'enum', enum: TOKEN_KINDS, enumName: 'token_kind' })
  kind: TokenKind;

  @Column({ type: 'varchar', length: 48, nullable: true })
  icon: TokenIcon | null;

  @Column({
    type: 'enum',
    enum: TOKEN_SEXES,
    enumName: 'token_sex',
    nullable: true,
  })
  sex: TokenSex | null;

  @Column({ type: 'boolean', default: false })
  hidden: boolean;

  @Column({ name: 'name_hidden', type: 'boolean', default: false })
  nameHidden: boolean;

  @Index('ix_tokens_owner_id')
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: 'fk_tokens_owner' })
  owner?: UserOrmEntity | null;

  @Index('ix_tokens_sheet_id')
  @Column({ name: 'sheet_id', type: 'uuid', nullable: true })
  sheetId: string | null;

  @Column({ type: 'integer' })
  col: number;

  @Column({ type: 'integer' })
  row: number;

  @Column({ type: 'smallint', default: 1 })
  size: number;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
