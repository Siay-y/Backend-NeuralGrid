import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { EnvService } from './core/config/env.service';
import { API_PREFIX, configureHttp } from './core/http/configure-http';
import { configureRealtime } from './core/realtime/configure-realtime';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttp(app);
  configureRealtime(app);

  const port = app.get(EnvService).get('PORT');
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `NeuralGrid API ouvindo em http://localhost:${port}/${API_PREFIX}`,
    'Bootstrap',
  );
}

void bootstrap();
