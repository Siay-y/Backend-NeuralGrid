import {
  IsBoolean,
  IsInt,
  Max,
  Min,
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

const RADIUS_MESSAGE = 'O alcance da luz precisa ser de 2 a 20 quadrados';

export class UpdateFogDto {
  @IsOptional()
  @IsBoolean({
    message: 'Informe se a névoa fica ligada com verdadeiro ou falso',
  })
  enabled?: boolean;

  @IsOptional()
  @IsInt({ message: RADIUS_MESSAGE })
  @Min(2, { message: RADIUS_MESSAGE })
  @Max(20, { message: RADIUS_MESSAGE })
  radius?: number;

  @IsOptional()
  @IsBoolean({
    message: 'Informe se a névoa lembra o caminho com verdadeiro ou falso',
  })
  memory?: boolean;
}
