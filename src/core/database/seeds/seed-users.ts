import { randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ProvisionUserUseCase } from '../../../modules/users/application/use-cases/provision-user.use-case';
import {
  isUserRole,
  type UserRole,
} from '../../../modules/users/domain/value-objects/user-role';
import { Argon2PasswordHasher } from '../../../modules/users/infrastructure/crypto/argon2-password-hasher';
import { UserOrmEntity } from '../../../modules/users/infrastructure/persistence/typeorm/entities/user.orm-entity';
import { TypeOrmUserRepository } from '../../../modules/users/infrastructure/persistence/typeorm/repositories/typeorm-user.repository';
import { buildDataSourceOptions } from '../database.options';
import { loadDotEnvIfPresent, readDatabaseSettings } from '../standalone-env';

interface RosterEntry {
  username: string;
  displayName: string;
  role: UserRole;
}

interface SeedReportRow {
  usuario: string;
  nome: string;
  papel: UserRole;
  resultado: string;
  senha: string;
}

const RESET_FLAG = '--reset-passwords';

function parseRoster(raw: string | undefined): RosterEntry[] {
  if (!raw?.trim()) {
    throw new Error(
      'Defina SEED_USERS no formato usuario:Nome de exibição:papel, separando cada pessoa por vírgula',
    );
  }

  const roster = raw
    .split(',')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const parts = chunk.split(':').map((part) => part.trim());
      const [username, displayName, role] = parts;
      if (
        parts.length !== 3 ||
        !username ||
        !displayName ||
        !isUserRole(role)
      ) {
        throw new Error(`Entrada inválida em SEED_USERS: "${chunk}"`);
      }
      return { username, displayName, role };
    });

  const masters = roster.filter((entry) => entry.role === 'master').length;
  if (masters !== 1) {
    throw new Error(
      `SEED_USERS precisa de exatamente um mestre, encontrei ${masters}`,
    );
  }

  const usernames = new Set(
    roster.map((entry) => entry.username.toLowerCase()),
  );
  if (usernames.size !== roster.length) {
    throw new Error('SEED_USERS contém usuários repetidos');
  }

  return roster;
}

function generatePassword(): string {
  return randomBytes(18).toString('base64url');
}

async function seed(): Promise<void> {
  loadDotEnvIfPresent();
  const resetPassword = process.argv.includes(RESET_FLAG);
  const roster = parseRoster(process.env.SEED_USERS);

  const dataSource = new DataSource(
    buildDataSourceOptions(readDatabaseSettings()),
  );
  await dataSource.initialize();

  try {
    await dataSource.runMigrations();
    const hasher = new Argon2PasswordHasher();

    const report = await dataSource.transaction(async (manager) => {
      const repository = new TypeOrmUserRepository(
        manager.getRepository(UserOrmEntity),
      );
      const provision = new ProvisionUserUseCase(repository, hasher);
      const rows: SeedReportRow[] = [];

      for (const entry of roster) {
        const password = generatePassword();
        const outcome = await provision.execute({
          ...entry,
          password,
          resetPassword,
        });
        rows.push({
          usuario: entry.username.toLowerCase(),
          nome: entry.displayName,
          papel: entry.role,
          resultado: outcome,
          senha: outcome === 'unchanged' ? '(mantida)' : password,
        });
      }
      return rows;
    });

    console.table(report);

    if (report.some((row) => row.resultado !== 'unchanged')) {
      console.log(
        '\nAs senhas acima não são armazenadas e não serão exibidas de novo. Entregue cada uma por um canal privado.',
      );
    }
    if (!resetPassword && report.some((row) => row.resultado === 'unchanged')) {
      console.log(
        `\nContas existentes foram mantidas. Use ${RESET_FLAG} para gerar senhas novas.`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
