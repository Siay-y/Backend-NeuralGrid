import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  DRAWING_CLEAR_SCOPES,
  type DrawingClearScope,
} from '../../../application/use-cases/clear-drawings.use-case';
import {
  DRAWING_LIMIT,
  DRAWING_MAX_POINTS,
} from '../../../domain/entities/drawing';
import { GRID_LIMIT } from '../../../domain/value-objects/grid-position';
import {
  DRAWING_COLORS,
  DRAWING_SHAPES,
  DRAWING_WIDTHS,
  type DrawingColor,
  type DrawingShape,
  type DrawingWidth,
} from '../../../domain/value-objects/drawing-style';

const SHAPE_MESSAGE = 'A forma precisa ser livre, seta, retângulo ou círculo';
const COLOR_MESSAGE = 'Cor de desenho desconhecida';
const WIDTH_MESSAGE = `A espessura precisa ser ${DRAWING_WIDTHS.join(', ')}`;
const POINTS_MESSAGE = `Envie entre 2 e ${DRAWING_MAX_POINTS} pontos dentro da grade`;
const IDS_MESSAGE = `Envie entre 1 e ${DRAWING_LIMIT} identificadores de desenho`;
const SCOPE_MESSAGE = 'Escolha apagar os seus desenhos ou todos';
const POSITION_MESSAGE = `A posição precisa ser um inteiro entre -${GRID_LIMIT} e ${GRID_LIMIT}`;

export class CreateDrawingDto {
  @IsIn(DRAWING_SHAPES, { message: SHAPE_MESSAGE })
  shape: DrawingShape;

  @IsIn(DRAWING_COLORS, { message: COLOR_MESSAGE })
  color: DrawingColor;

  @IsIn(DRAWING_WIDTHS, { message: WIDTH_MESSAGE })
  width: DrawingWidth;

  @IsArray({ message: POINTS_MESSAGE })
  @ArrayMinSize(4, { message: POINTS_MESSAGE })
  @ArrayMaxSize(DRAWING_MAX_POINTS * 2, { message: POINTS_MESSAGE })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { each: true, message: POINTS_MESSAGE },
  )
  @Min(-GRID_LIMIT, { each: true, message: POINTS_MESSAGE })
  @Max(GRID_LIMIT, { each: true, message: POINTS_MESSAGE })
  points: number[];
}

export class DrawingIdsDto {
  @IsArray({ message: IDS_MESSAGE })
  @ArrayMinSize(1, { message: IDS_MESSAGE })
  @ArrayMaxSize(DRAWING_LIMIT, { message: IDS_MESSAGE })
  @IsUUID('4', { each: true, message: IDS_MESSAGE })
  ids: string[];
}

export class ClearDrawingsDto {
  @IsIn(DRAWING_CLEAR_SCOPES, { message: SCOPE_MESSAGE })
  scope: DrawingClearScope;
}

export class RulerDto {
  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  fromCol: number;

  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  fromRow: number;

  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  toCol: number;

  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  toRow: number;
}
