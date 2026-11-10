import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatMessages1763942400000 implements MigrationInterface {
  name = 'CreateChatMessages1763942400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "chat_message_kind" AS ENUM ('text', 'roll')`,
    );
    await queryRunner.query(
      `CREATE TYPE "chat_message_visibility" AS ENUM ('public', 'gm', 'whisper')`,
    );
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "author_id" uuid NULL,
        "kind" "chat_message_kind" NOT NULL,
        "text" varchar(500) NULL,
        "roll" jsonb NULL,
        "visibility" "chat_message_visibility" NOT NULL,
        "recipient_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "fk_chat_messages_author" FOREIGN KEY ("author_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "fk_chat_messages_recipient" FOREIGN KEY ("recipient_id")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "ck_chat_messages_payload" CHECK (
          ("kind" = 'text' AND "text" IS NOT NULL AND "roll" IS NULL)
          OR ("kind" = 'roll' AND "roll" IS NOT NULL AND "text" IS NULL)
        ),
        CONSTRAINT "ck_chat_messages_text_not_blank"
          CHECK ("text" IS NULL OR length(btrim("text")) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_chat_messages_created_at" ON "chat_messages" ("created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TYPE "chat_message_visibility"`);
    await queryRunner.query(`DROP TYPE "chat_message_kind"`);
  }
}
