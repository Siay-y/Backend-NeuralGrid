import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { MapOrmEntity } from './map.orm-entity';

@Entity({ name: 'fog_explored' })
export class FogExploredOrmEntity {
  @PrimaryColumn({
    name: 'map_id',
    type: 'uuid',
    primaryKeyConstraintName: 'pk_fog_explored',
  })
  mapId: string;

  @PrimaryColumn({
    type: 'smallint',
    primaryKeyConstraintName: 'pk_fog_explored',
  })
  x2: number;

  @PrimaryColumn({
    type: 'smallint',
    primaryKeyConstraintName: 'pk_fog_explored',
  })
  y2: number;

  @ManyToOne(() => MapOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'map_id',
    foreignKeyConstraintName: 'fk_fog_explored_map',
  })
  map?: MapOrmEntity;
}
