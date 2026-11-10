import type { NestExpressApplication } from '@nestjs/platform-express';
import { EnvService } from '../config/env.service';
import { AppSocketIoAdapter } from './socket-io.adapter';

export function configureRealtime(app: NestExpressApplication): void {
  const env = app.get(EnvService);
  app.useWebSocketAdapter(
    new AppSocketIoAdapter(app, { allowedOrigins: env.get('CORS_ORIGINS') }),
  );
}
