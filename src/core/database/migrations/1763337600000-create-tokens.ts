import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTokens1763337600000 implements MigrationInterface {
  name = 'CreateTokens1763337600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "token_kind" AS ENUM ('agent', 'npc', 'threat')`,
    );
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "label" varchar(32) NOT NULL,
        "kind" "token_kind" NOT NULL,
        "owner_id" uuid NULL,
        "col" integer NOT NULL,
        "row" integer NOT NULL,
        "size" smallint NOT NULL DEFAULT 1,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_tokens_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "ck_tokens_label_not_blank"
          CHECK (length(btrim("label")) > 0),
        CONSTRAINT "ck_tokens_size" CHECK ("size" BETWEEN 1 AND 4),
        CONSTRAINT "ck_tokens_position"
          CHECK ("col" BETWEEN -500 AND 500 AND "row" BETWEEN -500 AND 500),
        CONSTRAINT "ck_tokens_version" CHECK ("version" >= 1)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_tokens_owner_id" ON "tokens" ("owner_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tokens"`);
    await queryRunner.query(`DROP TYPE "token_kind"`);
  }
}
