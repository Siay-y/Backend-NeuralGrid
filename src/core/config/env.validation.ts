import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { DatabaseSslMode } from '../database/database-ssl-mode';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const ORIGIN_PATTERN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i;
const DATABASE_URL_PATTERN = /^postgres(ql)?:\/\/.+/;
const DURATION_PATTERN = /^\d+[smhd]$/;

const toList = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : value;

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;

  @Transform(toList)
  @IsArray()
  @ArrayNotEmpty()
  @Matches(ORIGIN_PATTERN, {
    each: true,
    message:
      'CORS_ORIGINS aceita apenas origens no formato protocolo://host[:porta]',
  })
  CORS_ORIGINS: string[];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  TRUST_PROXY_HOPS = 0;

  @IsString()
  @Matches(DATABASE_URL_PATTERN, {
    message: 'DATABASE_URL precisa ser uma URL postgres://',
  })
  DATABASE_URL: string;

  @IsEnum(DatabaseSslMode)
  DATABASE_SSL_MODE: DatabaseSslMode = DatabaseSslMode.Verify;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET precisa de no mínimo 32 caracteres' })
  JWT_SECRET: string;

  @Matches(DURATION_PATTERN, {
    message: 'JWT_EXPIRES_IN aceita valores como 30m, 8h ou 1d',
  })
  JWT_EXPIRES_IN = '8h';

  @IsString()
  @MinLength(1)
  JWT_ISSUER = 'neuralgrid-api';

  @IsString()
  @MinLength(1)
  JWT_AUDIENCE = 'neuralgrid-web';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { whitelist: true });

  if (errors.length > 0) {
    const details = errors
      .map((error) => {
        const reasons = Object.values(error.constraints ?? {}).join('; ');
        return `  - ${error.property}: ${reasons}`;
      })
      .join('\n');
    throw new Error(`Configuração de ambiente inválida:\n${details}`);
  }

  return env;
}
