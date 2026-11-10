import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { EnvModule } from './core/config/env.module';
import { DatabaseModule } from './core/database/database.module';
import { HealthController } from './core/health/health.controller';
import { AppThrottlerGuard } from './core/security/app-throttler.guard';
import { buildThrottlerOptions } from './core/security/throttler.options';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/presentation/http/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/presentation/http/guards/roles.guard';
import { TabletopModule } from './modules/tabletop/tabletop.module';
import { UsersModule } from './modules/users/users.module';
import { GlobalExceptionFilter } from './shared/presentation/http/filters/global-exception.filter';

@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    ThrottlerModule.forRoot(buildThrottlerOptions()),
    UsersModule,
    AuthModule,
    TabletopModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
