import type { CharacterSheet } from '../entities/character-sheet';

export abstract class SheetRepository {
  abstract findAll(): Promise<CharacterSheet[]>;
  abstract findByOwner(ownerId: string): Promise<CharacterSheet[]>;
  abstract findById(id: string): Promise<CharacterSheet | null>;
  abstract count(): Promise<number>;
  abstract countByOwner(ownerId: string): Promise<number>;
  abstract save(sheet: CharacterSheet): Promise<void>;
  abstract delete(id: string): Promise<boolean>;
}
