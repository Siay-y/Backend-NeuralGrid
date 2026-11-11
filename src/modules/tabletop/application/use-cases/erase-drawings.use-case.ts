import { Injectable } from '@nestjs/common';
import { DrawingPolicy } from '../../domain/policies/drawing-policy';
import type { TableActor } from '../../domain/policies/token-policy';
import { DrawingRepository } from '../../domain/repositories/drawing.repository';
import type { DrawingsErased } from '../dtos/drawing-view';

@Injectable()
export class EraseDrawingsUseCase {
  constructor(private readonly drawings: DrawingRepository) {}

  async execute(
    actor: TableActor,
    ids: readonly string[],
  ): Promise<DrawingsErased> {
    const found = await this.drawings.findByIds([...new Set(ids)]);
    DrawingPolicy.assertCanErase(actor, found);
    const erased = await this.drawings.deleteByIds(
      found.map((drawing) => drawing.id),
    );
    return { by: actor.id, ids: erased };
  }
}
