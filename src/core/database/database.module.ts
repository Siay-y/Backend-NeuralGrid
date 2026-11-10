import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvService } from '../config/env.service';
import { buildDataSourceOptions } from './database.options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        ...buildDataSourceOptions({
          url: env.get('DATABASE_URL'),
          sslMode: env.get('DATABASE_SSL_MODE'),
        }),
        migrationsRun: true,
        retryAttempts: 5,
        retryDelay: 2000,
      }),
    }),
  ],
})
export class DatabaseModule {}
