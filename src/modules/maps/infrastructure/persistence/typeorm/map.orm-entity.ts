import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'maps' })
@Check('ck_maps_name_not_blank', `length(btrim("name")) > 0`)
@Index('uq_maps_single_active', ['active'], {
  unique: true,
  where: '"active"',
})
export class MapOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_maps' })
  id: string;

  @Column({ type: 'varchar', length: 48 })
  name: string;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
