import { existsSync } from 'node:fs';

if (existsSync('.env.test')) {
  process.loadEnvFile('.env.test');
}

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGINS ??= 'http://localhost:4200';
process.env.TRUST_PROXY_HOPS ??= '1';
process.env.DATABASE_URL ??=
  'postgres://neuralgrid:neuralgrid@localhost:5432/neuralgrid_test';
process.env.DATABASE_SSL_MODE ??= 'disable';
process.env.JWT_SECRET ??= 'segredo-de-teste-com-pelo-menos-32-caracteres';
