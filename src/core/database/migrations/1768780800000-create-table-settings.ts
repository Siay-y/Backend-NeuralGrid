import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTableSettings1768780800000 implements MigrationInterface {
  name = 'CreateTableSettings1768780800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "table_settings" (
        "id" smallint NOT NULL,
        "fog_enabled" boolean NOT NULL DEFAULT false,
        "light_radius" smallint NOT NULL DEFAULT 6,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_table_settings" PRIMARY KEY ("id"),
        CONSTRAINT "ck_table_settings_single_row" CHECK ("id" = 1),
        CONSTRAINT "ck_table_settings_light_radius"
          CHECK ("light_radius" BETWEEN 2 AND 20)
      )
    `);
    await queryRunner.query(`INSERT INTO "table_settings" ("id") VALUES (1)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "table_settings"`);
  }
}
