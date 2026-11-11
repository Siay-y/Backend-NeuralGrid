import type { Drawing } from '../domain/entities/drawing';
import { DrawingRepository } from '../domain/repositories/drawing.repository';

export class InMemoryDrawingRepository extends DrawingRepository {
  private readonly drawings = new Map<string, Drawing>();

  findAll(): Promise<Drawing[]> {
    return Promise.resolve([...this.drawings.values()]);
  }

  findByIds(ids: readonly string[]): Promise<Drawing[]> {
    return Promise.resolve(
      ids.flatMap((id) => {
        const drawing = this.drawings.get(id);
        return drawing ? [drawing] : [];
      }),
    );
  }

  count(): Promise<number> {
    return Promise.resolve(this.drawings.size);
  }

  save(drawing: Drawing): Promise<void> {
    this.drawings.set(drawing.id, drawing);
    return Promise.resolve();
  }

  deleteByIds(ids: readonly string[]): Promise<string[]> {
    return Promise.resolve(ids.filter((id) => this.drawings.delete(id)));
  }

  deleteByAuthor(authorId: string): Promise<string[]> {
    const ids = [...this.drawings.values()]
      .filter((drawing) => drawing.isAuthoredBy(authorId))
      .map((drawing) => drawing.id);
    return this.deleteByIds(ids);
  }

  deleteAll(): Promise<string[]> {
    return this.deleteByIds([...this.drawings.keys()]);
  }
}
