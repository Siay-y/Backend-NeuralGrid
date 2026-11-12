import {
  Check,
  Column,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'table_settings' })
@Check('ck_table_settings_single_row', `"id" = 1`)
@Check('ck_table_settings_light_radius', `"light_radius" BETWEEN 2 AND 20`)
export class TableSettingsOrmEntity {
  @PrimaryColumn({
    type: 'smallint',
    primaryKeyConstraintName: 'pk_table_settings',
  })
  id: number;

  @Column({ name: 'fog_enabled', type: 'boolean', default: false })
  fogEnabled: boolean;

  @Column({ name: 'light_radius', type: 'smallint', default: 6 })
  lightRadius: number;

  @Column({ name: 'fog_memory', type: 'boolean', default: false })
  fogMemory: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
