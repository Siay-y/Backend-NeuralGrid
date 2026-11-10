import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { EnvService } from '../config/env.service';

export const API_PREFIX = 'api';

export function configureHttp(app: NestExpressApplication): void {
  const env = app.get(EnvService);

  // Render terminates TLS in front of the service. Trusting exactly the known
  // number of proxy hops makes req.ip the real client address for throttling,
  // without letting a client spoof it through a forged X-Forwarded-For header.
  app.set('trust proxy', env.get('TRUST_PROXY_HOPS'));

  app.use(helmet());
  app.useBodyParser('json', { limit: '64kb' });
  app.enableCors({
    origin: env.get('CORS_ORIGINS'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Retry-After'],
    credentials: false,
    maxAge: 600,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );
  app.enableShutdownHooks();
}
