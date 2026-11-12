import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCombat1769040000000 implements MigrationInterface {
  name = 'CreateCombat1769040000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "combat" (
        "id" smallint NOT NULL,
        "round" integer NOT NULL DEFAULT 0,
        "turn_token_id" uuid,
        "combatants" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_combat" PRIMARY KEY ("id"),
        CONSTRAINT "ck_combat_single_row" CHECK ("id" = 1)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "combat"`);
  }
}
