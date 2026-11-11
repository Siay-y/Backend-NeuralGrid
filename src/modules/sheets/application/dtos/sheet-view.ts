import type { CharacterSheet } from '../../domain/entities/character-sheet';
import {
  type Gauge,
  type SheetData,
  sheetDefense,
  type SheetKind,
} from '../../domain/value-objects/sheet-data';

export interface SheetView {
  id: string;
  ownerId: string | null;
  kind: SheetKind;
  data: SheetData;
  hidden: boolean;
  nameHidden: boolean;
  statsHidden: boolean;
  version: number;
}

export interface SheetStats {
  id: string;
  hp: Gauge;
  defense: number;
}

export interface SheetChange {
  sheet: SheetView;
  previousOwnerId: string | null;
  identityChanged: boolean;
  statsChanged: boolean;
}

function identityKey(sheet: SheetView): string {
  const { name, codename, sex } = sheet.data.identity;
  return JSON.stringify([
    sheet.kind,
    sheet.ownerId,
    sheet.hidden,
    sheet.nameHidden,
    name,
    codename,
    sex,
  ]);
}

export function publicStats(sheet: SheetView): SheetStats | null {
  if (sheet.hidden || sheet.nameHidden || sheet.statsHidden) {
    return null;
  }
  return {
    id: sheet.id,
    hp: sheet.data.status.hp,
    defense: sheetDefense(sheet.data),
  };
}

export function sameStats(a: SheetView, b: SheetView): boolean {
  return JSON.stringify(publicStats(a)) === JSON.stringify(publicStats(b));
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
    hidden: sheet.hidden,
    nameHidden: sheet.nameHidden,
    statsHidden: sheet.statsHidden,
    version: sheet.version,
  };
}
