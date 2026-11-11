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
import { UserOrmEntity } from '../../../../users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import {
  SHEET_KINDS,
  type SheetData,
  type SheetKind,
} from '../../../domain/value-objects/sheet-data';

@Entity({ name: 'character_sheets' })
@Check('ck_character_sheets_name_not_blank', `length(btrim("name")) > 0`)
@Check('ck_character_sheets_version', `"version" >= 1`)
export class SheetOrmEntity {
  @PrimaryGeneratedColumn('uuid', {
    primaryKeyConstraintName: 'pk_character_sheets',
  })
  id: string;

  @Index('ix_character_sheets_owner_id')
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @ManyToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'owner_id',
    foreignKeyConstraintName: 'fk_character_sheets_owner',
  })
  owner?: UserOrmEntity | null;

  @Column({ type: 'enum', enum: SHEET_KINDS, enumName: 'token_kind' })
  kind: SheetKind;

  @Column({ type: 'varchar', length: 48 })
  name: string;

  @Column({ type: 'jsonb' })
  data: SheetData;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
