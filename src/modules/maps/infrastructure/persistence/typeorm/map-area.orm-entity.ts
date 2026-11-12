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
import type { MapImageType } from '../../../domain/value-objects/map-image';
import { MapOrmEntity } from './map.orm-entity';

@Entity({ name: 'map_areas' })
@Check('ck_map_areas_name_not_blank', `length(btrim("name")) > 0`)
@Check('ck_map_areas_size', `"width" > 0 AND "height" > 0 AND "byte_size" > 0`)
@Check('ck_map_areas_cell', `"cell_size" > 0`)
@Index('ix_map_areas_map', ['mapId', 'createdAt'])
export class MapAreaOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_map_areas' })
  id: string;

  @Column({ name: 'map_id', type: 'uuid' })
  mapId: string;

  @ManyToOne(() => MapOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'map_id',
    foreignKeyConstraintName: 'fk_map_areas_map',
  })
  map?: MapOrmEntity;

  @Column({ type: 'varchar', length: 48 })
  name: string;

  @Column({ name: 'image_type', type: 'varchar', length: 16 })
  imageType: MapImageType;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize: number;

  @Column({ type: 'char', length: 64 })
  checksum: string;

  @Column({ name: 'grid_col', type: 'double precision' })
  gridCol: number;

  @Column({ name: 'grid_row', type: 'double precision' })
  gridRow: number;

  @Column({ name: 'cell_size', type: 'double precision' })
  cellSize: number;

  @Column({ type: 'boolean', default: false })
  hidden: boolean;

  @Column({ type: 'bytea', select: false })
  image?: Buffer;

  @Column({ type: 'bytea', select: false })
  thumbnail?: Buffer;

  @Column({ name: 'thumbnail_type', type: 'varchar', length: 16 })
  thumbnailType: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
