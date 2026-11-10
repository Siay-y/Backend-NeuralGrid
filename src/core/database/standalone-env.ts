import { DatabaseSslMode } from './database-ssl-mode';
import type { DatabaseSettings } from './database.options';

export function loadDotEnvIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch {
    return;
  }
}

export function readDatabaseSettings(): DatabaseSettings {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não definida');
  }

  const rawMode = process.env.DATABASE_SSL_MODE ?? DatabaseSslMode.Verify;
  const modes = Object.values(DatabaseSslMode) as string[];
  if (!modes.includes(rawMode)) {
    throw new Error(
      `DATABASE_SSL_MODE inválido: "${rawMode}". Use ${modes.join(', ')}`,
    );
  }

  return { url, sslMode: rawMode as DatabaseSslMode };
}
