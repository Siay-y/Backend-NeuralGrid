import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Drawing, DRAWING_LIMIT } from '../../domain/entities/drawing';
import { DrawingLimitError } from '../../domain/errors/drawing-limit.error';
import type { TableActor } from '../../domain/policies/token-policy';
import { DrawingRepository } from '../../domain/repositories/drawing.repository';
import { type DrawingView, toDrawingView } from '../dtos/drawing-view';

export interface CreateDrawingInput {
  shape: unknown;
  color: unknown;
  width: unknown;
  points: readonly unknown[];
}

@Injectable()
export class CreateDrawingUseCase {
  constructor(private readonly drawings: DrawingRepository) {}

  async execute(
    actor: TableActor,
    input: CreateDrawingInput,
  ): Promise<DrawingView> {
    const drawing = Drawing.create({
      id: randomUUID(),
      authorId: actor.id,
      ...input,
      now: new Date(),
    });
    if ((await this.drawings.count()) >= DRAWING_LIMIT) {
      throw new DrawingLimitError(DRAWING_LIMIT);
    }
    await this.drawings.save(drawing);
    return toDrawingView(drawing);
  }
}
