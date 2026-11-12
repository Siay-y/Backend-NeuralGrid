import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAP_LIMITS } from '../../../domain/value-objects/map-image';

const CENTER_MESSAGE = 'A posição do mapa precisa ser um número da grade';

const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export class UploadMapDto {
  @IsString({ message: 'Dê um nome ao mapa' })
  @MaxLength(200, {
    message: `O nome do mapa aceita até ${MAP_LIMITS.name} caracteres`,
  })
  name: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: CENTER_MESSAGE },
  )
  @Min(-MAP_LIMITS.position, { message: CENTER_MESSAGE })
  @Max(MAP_LIMITS.position, { message: CENTER_MESSAGE })
  centerCol?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: CENTER_MESSAGE },
  )
  @Min(-MAP_LIMITS.position, { message: CENTER_MESSAGE })
  @Max(MAP_LIMITS.position, { message: CENTER_MESSAGE })
  centerRow?: number;
}
