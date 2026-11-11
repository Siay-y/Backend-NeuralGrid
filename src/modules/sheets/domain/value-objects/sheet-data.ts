import { InvalidSheetError } from '../errors/invalid-sheet.error';

export const SHEET_KINDS = ['agent', 'npc', 'threat'] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];

export const SHEET_SEXES = ['female', 'male', 'other'] as const;
export type SheetSex = (typeof SHEET_SEXES)[number];

export const ATTRIBUTES = [
  'strength',
  'agility',
  'resistance',
  'perception',
  'intelligence',
  'charisma',
  'luck',
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const SKILLS = [
  'acrobacia',
  'arcana',
  'atletismo',
  'percepcao',
  'historia',
  'intimidacao',
  'investigacao',
  'medicina',
  'performance',
  'persuasao',
  'furtividade',
] as const;
export type Skill = (typeof SKILLS)[number];

export const SHEET_SECTIONS = [
  'identity',
  'status',
  'attributes',
  'skills',
  'equipment',
] as const;
export type SheetSection = (typeof SHEET_SECTIONS)[number];

export const SHEET_LIMITS = {
  name: 48,
  short: 64,
  itemName: 48,
  damage: 24,
  age: 999,
  attribute: 30,
  bonus: 20,
  gauge: 9_999,
  armor: 99,
  movement: 999,
  quantity: 999,
  weight: 9_999,
  money: 9_999_999,
  xp: 9_999_999,
  weapons: 20,
  armors: 10,
  items: 40,
} as const;

export interface SheetIdentity {
  name: string;
  codename: string;
  age: number | null;
  sex: SheetSex | null;
  className: string;
}

export interface Gauge {
  current: number;
  max: number;
}

export interface SheetStatus {
  hp: Gauge;
  xp: number;
  movement: number;
  money: number;
  armor: number;
  carry: number;
}

export type SheetAttributes = Record<Attribute, number>;

export type SheetSkills = Record<Skill, number>;

export interface SheetWeapon {
  id: string;
  name: string;
  attribute: Attribute;
  bonus: number;
  damage: string;
  weight: number;
}

export interface SheetArmor {
  id: string;
  name: string;
  defense: number;
  bonus: number;
  weight: number;
}

export interface SheetItem {
  id: string;
  name: string;
  quantity: number;
  weight: number;
}

export interface SheetEquipment {
  weapons: SheetWeapon[];
  armors: SheetArmor[];
  items: SheetItem[];
}

export interface SheetData {
  identity: SheetIdentity;
  status: SheetStatus;
  attributes: SheetAttributes;
  skills: SheetSkills;
  equipment: SheetEquipment;
}

type Raw = Record<string, unknown>;

const ENTRY_ID = /^[A-Za-z0-9-]{1,36}$/;
const DAMAGE = /^[0-9dDkKhHlL+\-\s]*$/;

function record(value: unknown, field: string): Raw {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidSheetError(`O campo ${field} precisa ser um objeto`);
  }
  return value as Raw;
}

function text(value: unknown, max: number, field: string): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new InvalidSheetError(`O campo ${field} precisa ser um texto`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new InvalidSheetError(
      `O campo ${field} pode ter até ${max} caracteres`,
    );
  }
  return trimmed;
}

function integer(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  field: string,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new InvalidSheetError(
      `O campo ${field} precisa ser um inteiro entre ${min} e ${max}`,
    );
  }
  return value;
}

function weight(value: unknown): number {
  if (value === undefined) {
    return 0;
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > SHEET_LIMITS.weight
  ) {
    throw new InvalidSheetError(
      `O peso precisa ser um número entre 0 e ${SHEET_LIMITS.weight}`,
    );
  }
  return Math.round(value * 10) / 10;
}

function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  field: string,
): T | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!(options as readonly unknown[]).includes(value)) {
    throw new InvalidSheetError(`Valor desconhecido para ${field}`);
  }
  return value as T;
}

function bonus(value: unknown, field: string): number {
  return integer(value, -SHEET_LIMITS.bonus, SHEET_LIMITS.bonus, 0, field);
}

function list<T>(
  value: unknown,
  max: number,
  field: string,
  parse: (raw: Raw, id: string) => T,
): T[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > max) {
    throw new InvalidSheetError(`${field} pode ter até ${max} entradas`);
  }
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    const raw = record(entry, field);
    const id = raw.id;
    if (typeof id !== 'string' || !ENTRY_ID.test(id) || ids.has(id)) {
      throw new InvalidSheetError(`${field} com identificador inválido`);
    }
    ids.add(id);
    return parse(raw, id);
  });
}

function damage(value: unknown): string {
  const dice = text(value, SHEET_LIMITS.damage, 'dano');
  if (!DAMAGE.test(dice)) {
    throw new InvalidSheetError('O dano precisa ser em dados, como 1d8+2');
  }
  return dice;
}

function identity(value: unknown): SheetIdentity {
  const raw = record(value, 'identidade');
  return {
    name: text(raw.name, SHEET_LIMITS.name, 'nome'),
    codename: text(raw.codename, SHEET_LIMITS.short, 'codinome'),
    age:
      raw.age === undefined || raw.age === null
        ? null
        : integer(raw.age, 0, SHEET_LIMITS.age, 0, 'idade'),
    sex: choice(raw.sex, SHEET_SEXES, 'gênero'),
    className:
      typeof raw.className === 'string' || raw.className === undefined
        ? text(raw.className, SHEET_LIMITS.short, 'classe')
        : '',
  };
}

function status(value: unknown): SheetStatus {
  const raw = record(value, 'status');
  const hp = record(raw.hp, 'HP');
  return {
    hp: {
      current: integer(
        hp.current,
        -SHEET_LIMITS.gauge,
        SHEET_LIMITS.gauge,
        10,
        'HP atual',
      ),
      max: integer(hp.max, 0, SHEET_LIMITS.gauge, 10, 'HP máximo'),
    },
    xp: integer(raw.xp, 0, SHEET_LIMITS.xp, 0, 'XP'),
    movement: integer(raw.movement, 0, SHEET_LIMITS.movement, 9, 'movimento'),
    money: integer(raw.money, 0, SHEET_LIMITS.money, 0, 'dinheiro'),
    armor: integer(raw.armor, 0, SHEET_LIMITS.armor, 10, 'armadura'),
    carry: integer(raw.carry, 0, SHEET_LIMITS.weight, 50, 'carga'),
  };
}

function attributes(value: unknown): SheetAttributes {
  const raw = record(value, 'atributos');
  return Object.fromEntries(
    ATTRIBUTES.map((attribute) => [
      attribute,
      integer(raw[attribute], 0, SHEET_LIMITS.attribute, 10, 'atributo'),
    ]),
  ) as SheetAttributes;
}

function skills(value: unknown): SheetSkills {
  const raw = record(value, 'habilidades');
  return Object.fromEntries(
    SKILLS.map((skill) => [skill, bonus(raw[skill], 'bônus')]),
  ) as SheetSkills;
}

function equipment(value: unknown): SheetEquipment {
  const raw = record(value, 'equipamentos');
  return {
    weapons: list(raw.weapons, SHEET_LIMITS.weapons, 'Arma', (entry, id) => ({
      id,
      name: text(entry.name, SHEET_LIMITS.itemName, 'arma'),
      attribute: choice(entry.attribute, ATTRIBUTES, 'atributo') ?? 'strength',
      bonus: bonus(entry.bonus, 'bônus de ataque'),
      damage: damage(entry.damage),
      weight: weight(entry.weight),
    })),
    armors: list(raw.armors, SHEET_LIMITS.armors, 'Armadura', (entry, id) => ({
      id,
      name: text(entry.name, SHEET_LIMITS.itemName, 'armadura'),
      defense: integer(entry.defense, 0, SHEET_LIMITS.armor, 0, 'defesa'),
      bonus: bonus(entry.bonus, 'bônus da armadura'),
      weight: weight(entry.weight),
    })),
    items: list(raw.items, SHEET_LIMITS.items, 'Item', (entry, id) => ({
      id,
      name: text(entry.name, SHEET_LIMITS.itemName, 'item'),
      quantity: integer(
        entry.quantity,
        0,
        SHEET_LIMITS.quantity,
        1,
        'quantidade',
      ),
      weight: weight(entry.weight),
    })),
  };
}

const NORMALIZERS: { [K in SheetSection]: (value: unknown) => SheetData[K] } = {
  identity,
  status,
  attributes,
  skills,
  equipment,
};

function assertName(data: SheetData): SheetData {
  if (data.identity.name.length === 0) {
    throw new InvalidSheetError('Dê um nome ao personagem');
  }
  return data;
}

export function normalizeSheetData(value: unknown): SheetData {
  const raw = record(value, 'ficha');
  return assertName({
    identity: NORMALIZERS.identity(raw.identity),
    status: NORMALIZERS.status(raw.status),
    attributes: NORMALIZERS.attributes(raw.attributes),
    skills: NORMALIZERS.skills(raw.skills),
    equipment: NORMALIZERS.equipment(raw.equipment),
  });
}

export function mergeSheetData(
  current: SheetData,
  changes: unknown,
): SheetData {
  const raw = record(changes, 'alterações');
  const stray = Object.keys(raw).find(
    (key) => !(SHEET_SECTIONS as readonly string[]).includes(key),
  );
  if (stray !== undefined) {
    throw new InvalidSheetError(`Seção de ficha desconhecida: ${stray}`);
  }
  const next: SheetData = { ...current };
  for (const section of SHEET_SECTIONS) {
    if (raw[section] !== undefined) {
      (next as Record<SheetSection, unknown>)[section] = NORMALIZERS[section](
        raw[section],
      );
    }
  }
  return assertName(next);
}
