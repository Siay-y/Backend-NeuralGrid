import { InvalidDrawingError } from '../errors/invalid-drawing.error';
import { GRID_LIMIT } from '../value-objects/grid-position';
import {
  type DrawingColor,
  type DrawingShape,
  type DrawingWidth,
  isDrawingColor,
  isDrawingShape,
  isDrawingWidth,
} from '../value-objects/drawing-style';

export const DRAWING_MAX_POINTS = 1000;
export const DRAWING_LIMIT = 500;

const COORDINATE_PRECISION = 100;

export interface DrawingProps {
  id: string;
  authorId: string;
  shape: DrawingShape;
  color: DrawingColor;
  width: DrawingWidth;
  points: readonly number[];
  createdAt: Date;
}

export interface NewDrawingProps {
  id: string;
  authorId: string;
  shape: unknown;
  color: unknown;
  width: unknown;
  points: readonly unknown[];
  now: Date;
}

function assertShape(shape: unknown): DrawingShape {
  if (!isDrawingShape(shape)) {
    throw new InvalidDrawingError('Forma de desenho desconhecida');
  }
  return shape;
}

function assertColor(color: unknown): DrawingColor {
  if (!isDrawingColor(color)) {
    throw new InvalidDrawingError('Cor de desenho desconhecida');
  }
  return color;
}

function assertWidth(width: unknown): DrawingWidth {
  if (!isDrawingWidth(width)) {
    throw new InvalidDrawingError('Espessura de traço desconhecida');
  }
  return width;
}

function assertPoints(
  shape: DrawingShape,
  points: readonly unknown[],
): number[] {
  const count = points.length / 2;
  const validCount =
    Number.isInteger(count) &&
    (shape === 'free'
      ? count >= 2 && count <= DRAWING_MAX_POINTS
      : count === 2);
  if (!validCount) {
    throw new InvalidDrawingError(
      shape === 'free'
        ? `Um traço livre precisa ter entre 2 e ${DRAWING_MAX_POINTS} pontos`
        : 'Setas, retângulos e círculos precisam de exatamente 2 pontos',
    );
  }

  return points.map((value) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      Math.abs(value) > GRID_LIMIT
    ) {
      throw new InvalidDrawingError(
        `Os pontos precisam estar entre -${GRID_LIMIT} e ${GRID_LIMIT}`,
      );
    }
    return Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;
  });
}

export class Drawing {
  private constructor(private readonly props: Readonly<DrawingProps>) {}

  static create(input: NewDrawingProps): Drawing {
    const shape = assertShape(input.shape);
    return new Drawing({
      id: input.id,
      authorId: input.authorId,
      shape,
      color: assertColor(input.color),
      width: assertWidth(input.width),
      points: assertPoints(shape, input.points),
      createdAt: input.now,
    });
  }

  static restore(props: DrawingProps): Drawing {
    return new Drawing({ ...props, points: [...props.points] });
  }

  get id(): string {
    return this.props.id;
  }

  get authorId(): string {
    return this.props.authorId;
  }

  get shape(): DrawingShape {
    return this.props.shape;
  }

  get color(): DrawingColor {
    return this.props.color;
  }

  get width(): DrawingWidth {
    return this.props.width;
  }

  get points(): readonly number[] {
    return this.props.points;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isAuthoredBy(userId: string): boolean {
    return this.props.authorId === userId;
  }
}
