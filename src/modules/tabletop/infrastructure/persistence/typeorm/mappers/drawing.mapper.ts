import { Drawing } from '../../../../domain/entities/drawing';
import { DrawingOrmEntity } from '../entities/drawing.orm-entity';

export const DrawingMapper = {
  toDomain(row: DrawingOrmEntity): Drawing {
    return Drawing.restore({
      id: row.id,
      authorId: row.authorId,
      shape: row.shape,
      color: row.color,
      width: row.width,
      points: row.points,
      createdAt: row.createdAt,
    });
  },

  toOrm(drawing: Drawing): DrawingOrmEntity {
    const row = new DrawingOrmEntity();
    row.id = drawing.id;
    row.authorId = drawing.authorId;
    row.shape = drawing.shape;
    row.color = drawing.color;
    row.width = drawing.width;
    row.points = [...drawing.points];
    row.createdAt = drawing.createdAt;
    return row;
  },
};
