import {
  mergeSheetData,
  normalizeSheetData,
  type SheetData,
  type SheetKind,
} from '../value-objects/sheet-data';

export interface CharacterSheetProps {
  id: string;
  ownerId: string | null;
  kind: SheetKind;
  data: SheetData;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewCharacterSheetProps {
  id: string;
  ownerId: string | null;
  kind: SheetKind;
  data: unknown;
  now: Date;
}

export class CharacterSheet {
  private constructor(private readonly props: Readonly<CharacterSheetProps>) {}

  static create(input: NewCharacterSheetProps): CharacterSheet {
    return new CharacterSheet({
      id: input.id,
      ownerId: input.ownerId,
      kind: input.kind,
      data: normalizeSheetData(input.data),
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: CharacterSheetProps): CharacterSheet {
    return new CharacterSheet({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get kind(): SheetKind {
    return this.props.kind;
  }

  get name(): string {
    return this.props.data.identity.name;
  }

  get data(): SheetData {
    return this.props.data;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isOwnedBy(userId: string): boolean {
    return this.props.ownerId === userId;
  }

  edit(
    changes: {
      data?: unknown;
      kind?: SheetKind;
      ownerId?: string | null;
    },
    now: Date,
  ): CharacterSheet {
    return new CharacterSheet({
      ...this.props,
      data:
        changes.data === undefined
          ? this.props.data
          : mergeSheetData(this.props.data, changes.data),
      kind: changes.kind ?? this.props.kind,
      ownerId:
        changes.ownerId === undefined ? this.props.ownerId : changes.ownerId,
      version: this.props.version + 1,
      updatedAt: now,
    });
  }
}
