import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  TOKEN_LABEL_MAX_LENGTH,
  TOKEN_MAX_SIZE,
  TOKEN_MIN_SIZE,
} from '../../../domain/entities/token';
import { GRID_LIMIT } from '../../../domain/value-objects/grid-position';
import {
  TOKEN_ICONS,
  type TokenIcon,
} from '../../../domain/value-objects/token-icon';
import {
  TOKEN_SEXES,
  type TokenSex,
} from '../../../domain/value-objects/token-sex';
import {
  TOKEN_KINDS,
  type TokenKind,
} from '../../../domain/value-objects/token-kind';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const LABEL_MESSAGE = `O nome do token precisa ter entre 1 e ${TOKEN_LABEL_MAX_LENGTH} caracteres`;
const KIND_MESSAGE = 'O tipo precisa ser agente, NPC ou ameaça';
const OWNER_MESSAGE = 'O dono precisa ser um usuário da mesa ou nulo';
const SIZE_MESSAGE = `O tamanho precisa ser um inteiro entre ${TOKEN_MIN_SIZE} e ${TOKEN_MAX_SIZE}`;
const POSITION_MESSAGE = `A posição precisa ser um inteiro entre -${GRID_LIMIT} e ${GRID_LIMIT}`;
const ICON_MESSAGE = 'Ícone de token desconhecido';
const HIDDEN_MESSAGE = 'A visibilidade precisa ser verdadeiro ou falso';
const SEX_MESSAGE = 'O sexo precisa ser feminino, masculino, outro ou nulo';
const NAME_HIDDEN_MESSAGE = 'Esconder o nome precisa ser verdadeiro ou falso';
const LIGHT_MESSAGE = 'Iluminar na névoa precisa ser verdadeiro ou falso';
const ID_MESSAGE = 'Identificador de token inválido';
const SHEET_MESSAGE = 'A ficha precisa ser um identificador válido ou nula';

export class TokenIdDto {
  @IsUUID('4', { message: ID_MESSAGE })
  id: string;
}

export class TokenPositionDto extends TokenIdDto {
  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  col: number;

  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  row: number;
}

export class CreateTokenDto {
  @Transform(trim)
  @IsString({ message: LABEL_MESSAGE })
  @Length(1, TOKEN_LABEL_MAX_LENGTH, { message: LABEL_MESSAGE })
  label: string;

  @IsIn(TOKEN_KINDS, { message: KIND_MESSAGE })
  kind: TokenKind;

  @ValidateIf(
    (dto: CreateTokenDto) => dto.icon !== null && dto.icon !== undefined,
  )
  @IsIn(TOKEN_ICONS, { message: ICON_MESSAGE })
  icon?: TokenIcon | null;

  @IsOptional()
  @IsBoolean({ message: HIDDEN_MESSAGE })
  hidden?: boolean;

  @ValidateIf(
    (dto: CreateTokenDto) => dto.sex !== null && dto.sex !== undefined,
  )
  @IsIn(TOKEN_SEXES, { message: SEX_MESSAGE })
  sex?: TokenSex | null;

  @IsOptional()
  @IsBoolean({ message: NAME_HIDDEN_MESSAGE })
  nameHidden?: boolean;

  @IsOptional()
  @IsBoolean({ message: LIGHT_MESSAGE })
  emitsLight?: boolean;

  @IsOptional()
  @IsUUID('4', { message: OWNER_MESSAGE })
  ownerId?: string | null;

  @ValidateIf(
    (dto: CreateTokenDto) => dto.sheetId !== null && dto.sheetId !== undefined,
  )
  @IsUUID('4', { message: SHEET_MESSAGE })
  sheetId?: string | null;

  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  col: number;

  @IsInt({ message: POSITION_MESSAGE })
  @Min(-GRID_LIMIT, { message: POSITION_MESSAGE })
  @Max(GRID_LIMIT, { message: POSITION_MESSAGE })
  row: number;

  @IsOptional()
  @IsInt({ message: SIZE_MESSAGE })
  @Min(TOKEN_MIN_SIZE, { message: SIZE_MESSAGE })
  @Max(TOKEN_MAX_SIZE, { message: SIZE_MESSAGE })
  size?: number;
}

export class UpdateTokenDto extends TokenIdDto {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: LABEL_MESSAGE })
  @Length(1, TOKEN_LABEL_MAX_LENGTH, { message: LABEL_MESSAGE })
  label?: string;

  @IsOptional()
  @IsIn(TOKEN_KINDS, { message: KIND_MESSAGE })
  kind?: TokenKind;

  @ValidateIf(
    (dto: UpdateTokenDto) => dto.icon !== null && dto.icon !== undefined,
  )
  @IsIn(TOKEN_ICONS, { message: ICON_MESSAGE })
  icon?: TokenIcon | null;

  @IsOptional()
  @IsBoolean({ message: HIDDEN_MESSAGE })
  hidden?: boolean;

  @ValidateIf(
    (dto: UpdateTokenDto) => dto.sex !== null && dto.sex !== undefined,
  )
  @IsIn(TOKEN_SEXES, { message: SEX_MESSAGE })
  sex?: TokenSex | null;

  @IsOptional()
  @IsBoolean({ message: NAME_HIDDEN_MESSAGE })
  nameHidden?: boolean;

  @IsOptional()
  @IsBoolean({ message: LIGHT_MESSAGE })
  emitsLight?: boolean;

  @ValidateIf(
    (dto: UpdateTokenDto) => dto.ownerId !== null && dto.ownerId !== undefined,
  )
  @IsUUID('4', { message: OWNER_MESSAGE })
  ownerId?: string | null;

  @ValidateIf(
    (dto: UpdateTokenDto) => dto.sheetId !== null && dto.sheetId !== undefined,
  )
  @IsUUID('4', { message: SHEET_MESSAGE })
  sheetId?: string | null;

  @IsOptional()
  @IsInt({ message: SIZE_MESSAGE })
  @Min(TOKEN_MIN_SIZE, { message: SIZE_MESSAGE })
  @Max(TOKEN_MAX_SIZE, { message: SIZE_MESSAGE })
  size?: number;
}
