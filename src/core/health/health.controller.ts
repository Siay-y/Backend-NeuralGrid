import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { minutes, SkipThrottle, Throttle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { Public } from '../../shared/presentation/http/decorators/public.decorator';

export const DATABASE_HEALTH_LIMIT = 30;

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @SkipThrottle()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Throttle({ default: { limit: DATABASE_HEALTH_LIMIT, ttl: minutes(1) } })
  @Get('db')
  async database(): Promise<{ status: 'ok'; database: 'up' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível');
    }
    return { status: 'ok', database: 'up' };
  }
}
