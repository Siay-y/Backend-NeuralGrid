import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables, NodeEnvironment } from './env.validation';

@Injectable()
export class EnvService {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === NodeEnvironment.Production;
  }
}
