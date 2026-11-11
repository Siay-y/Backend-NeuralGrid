import type { Drawing } from '../../domain/entities/drawing';
import type {
  DrawingColor,
  DrawingShape,
  DrawingWidth,
} from '../../domain/value-objects/drawing-style';

export interface DrawingView {
  id: string;
  authorId: string;
  shape: DrawingShape;
  color: DrawingColor;
  width: DrawingWidth;
  points: number[];
}

export interface DrawingsErased {
  by: string;
  ids: string[];
}

export function toDrawingView(drawing: Drawing): DrawingView {
  return {
    id: drawing.id,
    authorId: drawing.authorId,
    shape: drawing.shape,
    color: drawing.color,
    width: drawing.width,
    points: [...drawing.points],
  };
}
