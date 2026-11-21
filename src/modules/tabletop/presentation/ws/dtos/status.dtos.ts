import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  DEBUFF_KINDS,
  STATUS_KINDS,
  STATUS_LIMITS,
  type StatusKind,
} from '../../../domain/value-objects/token-status';

const ID_MESSAGE = 'Identificador de token inválido';
const KIND_MESSAGE = 'Status desconhecido';
const TURNS_MESSAGE = `A duração precisa ser de 1 a ${STATUS_LIMITS.turns} turnos`;

export class StatusTargetDto {
  @IsUUID('4', { message: ID_MESSAGE })
  tokenId: string;

  @IsIn(STATUS_KINDS, { message: KIND_MESSAGE })
  kind: StatusKind;
}

export class ApplyStatusDto extends StatusTargetDto {
  @IsOptional()
  @ValidateIf((dto: ApplyStatusDto) => dto.turns !== null)
  @IsInt({ message: TURNS_MESSAGE })
  @Min(1, { message: TURNS_MESSAGE })
  @Max(STATUS_LIMITS.turns, { message: TURNS_MESSAGE })
  turns?: number | null;

  @IsOptional()
  @ValidateIf((dto: ApplyStatusDto) => dto.amount !== null)
  @IsString({ message: 'O valor precisa ser um texto, como 1d6' })
  @MaxLength(STATUS_LIMITS.amount, {
    message: `O valor pode ter no máximo ${STATUS_LIMITS.amount} caracteres`,
  })
  amount?: string | null;

  @IsOptional()
  @IsArray({ message: 'Escolha os efeitos da imunidade' })
  @ArrayMaxSize(DEBUFF_KINDS.length, {
    message: 'Escolha os efeitos da imunidade',
  })
  @IsIn(DEBUFF_KINDS, { each: true, message: KIND_MESSAGE })
  immuneTo?: string[];
}
