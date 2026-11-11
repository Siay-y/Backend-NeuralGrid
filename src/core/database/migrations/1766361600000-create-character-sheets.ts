import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCharacterSheets1766361600000 implements MigrationInterface {
  name = 'CreateCharacterSheets1766361600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "character_sheets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_id" uuid NULL,
        "kind" "token_kind" NOT NULL,
        "name" varchar(48) NOT NULL,
        "data" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_character_sheets" PRIMARY KEY ("id"),
        CONSTRAINT "fk_character_sheets_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "ck_character_sheets_name_not_blank"
          CHECK (length(btrim("name")) > 0),
        CONSTRAINT "ck_character_sheets_version" CHECK ("version" >= 1)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_character_sheets_owner_id" ON "character_sheets" ("owner_id")`,
    );
    await queryRunner.query(`ALTER TABLE "tokens" ADD "sheet_id" uuid NULL`);
    await queryRunner.query(`
      ALTER TABLE "tokens" ADD CONSTRAINT "fk_tokens_sheet"
        FOREIGN KEY ("sheet_id") REFERENCES "character_sheets" ("id")
        ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_tokens_sheet_id" ON "tokens" ("sheet_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "ix_tokens_sheet_id"`);
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP CONSTRAINT "fk_tokens_sheet"`,
    );
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "sheet_id"`);
    await queryRunner.query(`DROP TABLE "character_sheets"`);
  }
}
