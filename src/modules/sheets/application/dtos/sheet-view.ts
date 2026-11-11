import type { CharacterSheet } from '../../domain/entities/character-sheet';
import type {
  SheetData,
  SheetKind,
} from '../../domain/value-objects/sheet-data';

export interface SheetView {
  id: string;
  ownerId: string | null;
  kind: SheetKind;
  data: SheetData;
  version: number;
}

export interface SheetChange {
  sheet: SheetView;
  previousOwnerId: string | null;
  identityChanged: boolean;
}

function identityKey(sheet: SheetView): string {
  const { name, codename, sex } = sheet.data.identity;
  return JSON.stringify([sheet.kind, sheet.ownerId, name, codename, sex]);
}

export function sameIdentity(a: SheetView, b: SheetView): boolean {
  return identityKey(a) === identityKey(b);
}

export function toSheetView(sheet: CharacterSheet): SheetView {
  return {
    id: sheet.id,
    ownerId: sheet.ownerId,
    kind: sheet.kind,
    data: sheet.data,
    version: sheet.version,
  };
}
