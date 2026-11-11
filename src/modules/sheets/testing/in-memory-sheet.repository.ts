import type { CharacterSheet } from '../domain/entities/character-sheet';
import { SheetRepository } from '../domain/repositories/sheet.repository';

export class InMemorySheetRepository extends SheetRepository {
  private readonly sheets = new Map<string, CharacterSheet>();

  findAll(): Promise<CharacterSheet[]> {
    return Promise.resolve([...this.sheets.values()]);
  }

  findByOwner(ownerId: string): Promise<CharacterSheet[]> {
    return Promise.resolve(
      [...this.sheets.values()].filter((sheet) => sheet.isOwnedBy(ownerId)),
    );
  }

  findById(id: string): Promise<CharacterSheet | null> {
    return Promise.resolve(this.sheets.get(id) ?? null);
  }

  count(): Promise<number> {
    return Promise.resolve(this.sheets.size);
  }

  async countByOwner(ownerId: string): Promise<number> {
    return (await this.findByOwner(ownerId)).length;
  }

  save(sheet: CharacterSheet): Promise<void> {
    this.sheets.set(sheet.id, sheet);
    return Promise.resolve();
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.sheets.delete(id));
  }
}
