import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../../../../users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import {
  DRAWING_SHAPES,
  type DrawingColor,
  type DrawingShape,
  type DrawingWidth,
} from '../../../../domain/value-objects/drawing-style';

@Entity({ name: 'drawings' })
@Check('ck_drawings_width', `"width" BETWEEN 1 AND 16`)
@Check('ck_drawings_points', `jsonb_typeof("points") = 'array'`)
export class DrawingOrmEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_drawings' })
  id: string;

  @Index('ix_drawings_author_id')
  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'fk_drawings_author',
  })
  author?: UserOrmEntity;

  @Column({ type: 'enum', enum: DRAWING_SHAPES, enumName: 'drawing_shape' })
  shape: DrawingShape;

  @Column({ type: 'varchar', length: 16 })
  color: DrawingColor;

  @Column({ type: 'smallint' })
  width: DrawingWidth;

  @Column({ type: 'jsonb' })
  points: number[];

  @Index('ix_drawings_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
