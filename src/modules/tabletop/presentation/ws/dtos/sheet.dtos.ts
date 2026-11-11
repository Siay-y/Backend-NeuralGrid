import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import {
  SHEET_KINDS,
  type SheetKind,
} from '../../../../sheets/domain/value-objects/sheet-data';

const ID_MESSAGE = 'Identificador de ficha inválido';
const KIND_MESSAGE = 'O tipo precisa ser agente, NPC ou ameaça';
const OWNER_MESSAGE = 'O dono precisa ser um usuário da mesa ou nulo';
const DATA_MESSAGE = 'Envie os dados da ficha como um objeto';
const FLAG_MESSAGE = 'A visibilidade precisa ser verdadeira ou falsa';

export class SheetIdDto {
  @IsUUID('4', { message: ID_MESSAGE })
  id: string;
}

export class CreateSheetDto {
  @IsOptional()
  @IsIn(SHEET_KINDS, { message: KIND_MESSAGE })
  kind?: SheetKind;

  @ValidateIf(
    (dto: CreateSheetDto) => dto.ownerId !== null && dto.ownerId !== undefined,
  )
  @IsUUID('4', { message: OWNER_MESSAGE })
  ownerId?: string | null;

  @IsOptional()
  @IsBoolean({ message: FLAG_MESSAGE })
  hidden?: boolean;

  @IsOptional()
  @IsBoolean({ message: FLAG_MESSAGE })
  nameHidden?: boolean;

  @IsOptional()
  @IsBoolean({ message: FLAG_MESSAGE })
  statsHidden?: boolean;

  @IsObject({ message: DATA_MESSAGE })
  data: Record<string, unknown>;
}

export class UpdateSheetDto extends SheetIdDto {
  @IsOptional()
  @IsIn(SHEET_KINDS, { message: KIND_MESSAGE })
  kind?: SheetKind;

  @ValidateIf(
    (dto: UpdateSheetDto) => dto.ownerId !== null && dto.ownerId !== undefined,
  )
  @IsUUID('4', { message: OWNER_MESSAGE })
  ownerId?: string | null;

  @IsOptional()
  @IsBoolean({ message: FLAG_MESSAGE })
  hidden?: boolean;

  @IsOptional()
  @IsBoolean({ message: FLAG_MESSAGE })
  nameHidden?: boolean;

  @IsOptional()
  @IsBoolean({ message: FLAG_MESSAGE })
  statsHidden?: boolean;

  @IsOptional()
  @IsObject({ message: DATA_MESSAGE })
  data?: Record<string, unknown>;
}
