import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const ID_MESSAGE = 'Identificador de mapa inválido';
const NUMBER_MESSAGE = 'A posição e o tamanho do mapa precisam ser números';
const NAME_MESSAGE = 'O nome do mapa precisa ser um texto';

export class MapIdDto {
  @IsUUID('4', { message: ID_MESSAGE })
  id: string;
}

export class ActivateMapDto {
  @ValidateIf((dto: ActivateMapDto) => dto.id !== null)
  @IsUUID('4', { message: ID_MESSAGE })
  id: string | null;
}

export class RenameMapDto extends MapIdDto {
  @IsString({ message: NAME_MESSAGE })
  @MaxLength(200, { message: NAME_MESSAGE })
  name: string;
}

export class UpdateAreaDto extends MapIdDto {
  @IsOptional()
  @IsString({ message: NAME_MESSAGE })
  @MaxLength(200, { message: NAME_MESSAGE })
  name?: string;

  @IsOptional()
  @IsBoolean({
    message: 'Informe se a área fica oculta com verdadeiro ou falso',
  })
  hidden?: boolean;

  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: NUMBER_MESSAGE },
  )
  col?: number;

  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: NUMBER_MESSAGE },
  )
  row?: number;

  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: NUMBER_MESSAGE },
  )
  cell?: number;
}
