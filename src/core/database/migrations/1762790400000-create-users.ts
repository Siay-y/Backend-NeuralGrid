import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1762790400000 implements MigrationInterface {
  name = 'CreateUsers1762790400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('master', 'player')`,
    );
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" varchar(32) NOT NULL,
        "display_name" varchar(64) NOT NULL,
        "role" "user_role" NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_username" UNIQUE ("username"),
        CONSTRAINT "ck_users_username_format"
          CHECK ("username" ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$'),
        CONSTRAINT "ck_users_display_name_not_blank"
          CHECK (length(btrim("display_name")) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_single_master" ON "users" ("role") WHERE "role" = 'master'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_users_single_master"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
