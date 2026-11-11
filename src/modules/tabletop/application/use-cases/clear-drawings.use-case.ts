import { Injectable } from '@nestjs/common';
import { DrawingPolicy } from '../../domain/policies/drawing-policy';
import type { TableActor } from '../../domain/policies/token-policy';
import { DrawingRepository } from '../../domain/repositories/drawing.repository';
import type { DrawingsErased } from '../dtos/drawing-view';

export const DRAWING_CLEAR_SCOPES = ['mine', 'all'] as const;

export type DrawingClearScope = (typeof DRAWING_CLEAR_SCOPES)[number];

@Injectable()
export class ClearDrawingsUseCase {
  constructor(private readonly drawings: DrawingRepository) {}

  async execute(
    actor: TableActor,
    scope: DrawingClearScope,
  ): Promise<DrawingsErased> {
    if (scope === 'all') {
      DrawingPolicy.assertCanClearAll(actor);
      return { by: actor.id, ids: await this.drawings.deleteAll() };
    }
    return { by: actor.id, ids: await this.drawings.deleteByAuthor(actor.id) };
  }
}
