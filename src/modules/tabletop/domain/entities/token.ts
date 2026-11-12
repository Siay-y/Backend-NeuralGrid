import { InvalidTokenError } from '../errors/invalid-token.error';
import { gridPosition } from '../value-objects/grid-position';
import { isTokenIcon, type TokenIcon } from '../value-objects/token-icon';
import { isTokenKind, type TokenKind } from '../value-objects/token-kind';
import { isTokenSex, type TokenSex } from '../value-objects/token-sex';

export const TOKEN_LABEL_MAX_LENGTH = 32;
export const TOKEN_MIN_SIZE = 1;
export const TOKEN_MAX_SIZE = 4;

export interface TokenProps {
  id: string;
  label: string;
  kind: TokenKind;
  icon: TokenIcon | null;
  sex: TokenSex | null;
  hidden: boolean;
  nameHidden: boolean;
  emitsLight: boolean;
  ownerId: string | null;
  sheetId: string | null;
  col: number;
  row: number;
  size: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenDetails {
  label: string;
  kind: TokenKind;
  icon: TokenIcon | null;
  sex: TokenSex | null;
  hidden: boolean;
  nameHidden: boolean;
  emitsLight: boolean;
  ownerId: string | null;
  sheetId: string | null;
  size: number;
}

export interface NewTokenProps extends TokenDetails {
  id: string;
  col: number;
  row: number;
  now: Date;
}

function assertLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > TOKEN_LABEL_MAX_LENGTH) {
    throw new InvalidTokenError(
      `O nome do token precisa ter entre 1 e ${TOKEN_LABEL_MAX_LENGTH} caracteres`,
    );
  }
  return trimmed;
}

function assertKind(kind: unknown): TokenKind {
  if (!isTokenKind(kind)) {
    throw new InvalidTokenError(
      `Tipo de token desconhecido: "${String(kind)}"`,
    );
  }
  return kind;
}

function assertIcon(icon: unknown): TokenIcon | null {
  if (icon === null) {
    return null;
  }
  if (!isTokenIcon(icon)) {
    throw new InvalidTokenError('Ícone de token desconhecido');
  }
  return icon;
}

function assertSex(sex: unknown): TokenSex | null {
  if (sex === null) {
    return null;
  }
  if (!isTokenSex(sex)) {
    throw new InvalidTokenError('Sexo do token desconhecido');
  }
  return sex;
}

function assertSize(size: number): number {
  if (
    !Number.isInteger(size) ||
    size < TOKEN_MIN_SIZE ||
    size > TOKEN_MAX_SIZE
  ) {
    throw new InvalidTokenError(
      `O tamanho do token precisa ser um inteiro entre ${TOKEN_MIN_SIZE} e ${TOKEN_MAX_SIZE}`,
    );
  }
  return size;
}

function validDetails(details: TokenDetails): TokenDetails {
  return {
    label: assertLabel(details.label),
    kind: assertKind(details.kind),
    icon: assertIcon(details.icon),
    sex: assertSex(details.sex),
    hidden: details.hidden === true,
    nameHidden: details.nameHidden === true,
    emitsLight: details.emitsLight !== false,
    ownerId: details.ownerId,
    sheetId: details.sheetId,
    size: assertSize(details.size),
  };
}

export class Token {
  private constructor(private readonly props: Readonly<TokenProps>) {}

  static create(input: NewTokenProps): Token {
    const { col, row } = gridPosition(input.col, input.row);
    return new Token({
      id: input.id,
      ...validDetails(input),
      col,
      row,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(props: TokenProps): Token {
    return new Token({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get label(): string {
    return this.props.label;
  }

  get kind(): TokenKind {
    return this.props.kind;
  }

  get icon(): TokenIcon | null {
    return this.props.icon;
  }

  get hidden(): boolean {
    return this.props.hidden;
  }

  get sex(): TokenSex | null {
    return this.props.sex;
  }

  get nameHidden(): boolean {
    return this.props.nameHidden;
  }

  get emitsLight(): boolean {
    return this.props.emitsLight;
  }

  get ownerId(): string | null {
    return this.props.ownerId;
  }

  get sheetId(): string | null {
    return this.props.sheetId;
  }

  get details(): TokenDetails {
    const {
      label,
      kind,
      icon,
      sex,
      hidden,
      nameHidden,
      emitsLight,
      ownerId,
      sheetId,
    } = this.props;
    return {
      label,
      kind,
      icon,
      sex,
      hidden,
      nameHidden,
      emitsLight,
      ownerId,
      sheetId,
      size: this.props.size,
    };
  }

  get col(): number {
    return this.props.col;
  }

  get row(): number {
    return this.props.row;
  }

  get size(): number {
    return this.props.size;
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

  moveTo(col: number, row: number, now: Date): Token {
    return new Token({
      ...this.props,
      ...gridPosition(col, row),
      version: this.props.version + 1,
      updatedAt: now,
    });
  }

  withDetails(details: TokenDetails, now: Date): Token {
    return new Token({
      ...this.props,
      ...validDetails(details),
      version: this.props.version + 1,
      updatedAt: now,
    });
  }
}
