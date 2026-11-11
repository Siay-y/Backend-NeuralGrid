import type { Drawing } from '../entities/drawing';

export abstract class DrawingRepository {
  abstract findAll(): Promise<Drawing[]>;
  abstract findByIds(ids: readonly string[]): Promise<Drawing[]>;
  abstract count(): Promise<number>;
  abstract save(drawing: Drawing): Promise<void>;
  abstract deleteByIds(ids: readonly string[]): Promise<string[]>;
  abstract deleteByAuthor(authorId: string): Promise<string[]>;
  abstract deleteAll(): Promise<string[]>;
}
