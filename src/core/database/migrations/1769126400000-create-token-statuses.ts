import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTokenStatuses1769126400000 implements MigrationInterface {
  name = 'CreateTokenStatuses1769126400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "token_status_kind" AS ENUM (
        'bleeding', 'poison', 'slow', 'mind-control', 'blind', 'burning',
        'confused', 'death', 'giant', 'invisible', 'immune', 'haste',
        'damage-reduction', 'iron-skin', 'regeneration'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "token_statuses" (
        "token_id" uuid NOT NULL,
        "kind" "token_status_kind" NOT NULL,
        "turns" smallint,
        "amount" varchar(64),
        "immune_to" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "applied_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_token_statuses" PRIMARY KEY ("token_id", "kind"),
        CONSTRAINT "fk_token_statuses_token" FOREIGN KEY ("token_id")
          REFERENCES "tokens"("id") ON DELETE CASCADE,
        CONSTRAINT "ck_token_statuses_turns"
          CHECK ("turns" IS NULL OR "turns" BETWEEN 1 AND 99)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "token_statuses"`);
    await queryRunner.query(`DROP TYPE "token_status_kind"`);
  }
}
