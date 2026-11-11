import type { Drawing } from '../entities/drawing';
import { DrawingForbiddenError } from '../errors/drawing-forbidden.error';
import type { TableActor } from './token-policy';

export const DrawingPolicy = {
  canErase(actor: TableActor, drawing: Drawing): boolean {
    return actor.role === 'master' || drawing.isAuthoredBy(actor.id);
  },

  canClearAll(actor: TableActor): boolean {
    return actor.role === 'master';
  },

  assertCanErase(actor: TableActor, drawings: readonly Drawing[]): void {
    if (drawings.some((drawing) => !DrawingPolicy.canErase(actor, drawing))) {
      throw new DrawingForbiddenError('Você só pode apagar os seus desenhos');
    }
  },

  assertCanClearAll(actor: TableActor): void {
    if (!DrawingPolicy.canClearAll(actor)) {
      throw new DrawingForbiddenError(
        'Só o mestre pode apagar os desenhos de todos',
      );
    }
  },
};
