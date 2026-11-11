import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDrawings1765756800000 implements MigrationInterface {
  name = 'CreateDrawings1765756800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "drawing_shape" AS ENUM ('free', 'arrow', 'rect', 'ellipse')`,
    );
    await queryRunner.query(`
      CREATE TABLE "drawings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "author_id" uuid NOT NULL,
        "shape" "drawing_shape" NOT NULL,
        "color" varchar(16) NOT NULL,
        "width" smallint NOT NULL,
        "points" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_drawings" PRIMARY KEY ("id"),
        CONSTRAINT "fk_drawings_author" FOREIGN KEY ("author_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "ck_drawings_width" CHECK ("width" BETWEEN 1 AND 16),
        CONSTRAINT "ck_drawings_points"
          CHECK (jsonb_typeof("points") = 'array')
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_drawings_author_id" ON "drawings" ("author_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "ix_drawings_created_at" ON "drawings" ("created_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "drawings"`);
    await queryRunner.query(`DROP TYPE "drawing_shape"`);
  }
}
