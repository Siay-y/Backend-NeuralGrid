import { Injectable } from '@nestjs/common';
import { DrawingRepository } from '../../domain/repositories/drawing.repository';
import { type DrawingView, toDrawingView } from '../dtos/drawing-view';

@Injectable()
export class ListDrawingsUseCase {
  constructor(private readonly drawings: DrawingRepository) {}

  async execute(): Promise<DrawingView[]> {
    const drawings = await this.drawings.findAll();
    return drawings.map(toDrawingView);
  }
}
