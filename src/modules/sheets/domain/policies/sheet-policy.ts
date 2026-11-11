import type { UserRole } from '../../../users/domain/value-objects/user-role';
import type { CharacterSheet } from '../entities/character-sheet';
import { SheetForbiddenError } from '../errors/sheet-forbidden.error';

export interface SheetActor {
  id: string;
  role: UserRole;
}

export const SheetPolicy = {
  canEdit(actor: SheetActor, sheet: CharacterSheet): boolean {
    return actor.role === 'master' || sheet.isOwnedBy(actor.id);
  },

  canAssign(actor: SheetActor): boolean {
    return actor.role === 'master';
  },

  assertCanAssign(actor: SheetActor): void {
    if (!SheetPolicy.canAssign(actor)) {
      throw new SheetForbiddenError(
        'Só o mestre muda o tipo, o dono ou a visibilidade de uma ficha',
      );
    }
  },
};
