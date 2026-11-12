import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaps1768176000000 implements MigrationInterface {
  name = 'CreateMaps1768176000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "maps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(48) NOT NULL,
        "active" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_maps" PRIMARY KEY ("id"),
        CONSTRAINT "ck_maps_name_not_blank" CHECK (length(btrim("name")) > 0)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_maps_single_active" ON "maps" ("active") WHERE "active"`,
    );
    await queryRunner.query(`
      CREATE TABLE "map_areas" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "map_id" uuid NOT NULL,
        "name" varchar(48) NOT NULL,
        "image_type" varchar(16) NOT NULL,
        "width" integer NOT NULL,
        "height" integer NOT NULL,
        "byte_size" integer NOT NULL,
        "checksum" char(64) NOT NULL,
        "grid_col" double precision NOT NULL,
        "grid_row" double precision NOT NULL,
        "cell_size" double precision NOT NULL,
        "hidden" boolean NOT NULL DEFAULT false,
        "image" bytea NOT NULL,
        "thumbnail" bytea NOT NULL,
        "thumbnail_type" varchar(16) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_map_areas" PRIMARY KEY ("id"),
        CONSTRAINT "fk_map_areas_map" FOREIGN KEY ("map_id")
          REFERENCES "maps" ("id") ON DELETE CASCADE,
        CONSTRAINT "ck_map_areas_name_not_blank"
          CHECK (length(btrim("name")) > 0),
        CONSTRAINT "ck_map_areas_size"
          CHECK ("width" > 0 AND "height" > 0 AND "byte_size" > 0),
        CONSTRAINT "ck_map_areas_cell" CHECK ("cell_size" > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "ix_map_areas_map" ON "map_areas" ("map_id", "created_at")`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_areas" ALTER COLUMN "image" SET STORAGE EXTERNAL`,
    );
    await queryRunner.query(
      `ALTER TABLE "map_areas" ALTER COLUMN "thumbnail" SET STORAGE EXTERNAL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "map_areas"`);
    await queryRunner.query(`DROP INDEX "uq_maps_single_active"`);
    await queryRunner.query(`DROP TABLE "maps"`);
  }
}
