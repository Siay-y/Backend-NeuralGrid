import { InvalidTokenError } from '../errors/invalid-token.error';

export const GRID_LIMIT = 500;

export interface GridPosition {
  col: number;
  row: number;
}

function assertCoordinate(value: number, axis: string): void {
  if (!Number.isInteger(value) || value < -GRID_LIMIT || value > GRID_LIMIT) {
    throw new InvalidTokenError(
      `A ${axis} precisa ser um inteiro entre -${GRID_LIMIT} e ${GRID_LIMIT}`,
    );
  }
}

export function gridPosition(col: number, row: number): GridPosition {
  assertCoordinate(col, 'coluna');
  assertCoordinate(row, 'linha');
  return { col, row };
}
