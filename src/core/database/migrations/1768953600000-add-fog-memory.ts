import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFogMemory1768953600000 implements MigrationInterface {
  name = 'AddFogMemory1768953600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "table_settings" ADD "fog_memory" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      CREATE TABLE "fog_explored" (
        "map_id" uuid NOT NULL,
        "x2" smallint NOT NULL,
        "y2" smallint NOT NULL,
        CONSTRAINT "pk_fog_explored" PRIMARY KEY ("map_id", "x2", "y2"),
        CONSTRAINT "fk_fog_explored_map" FOREIGN KEY ("map_id")
          REFERENCES "maps" ("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "fog_explored"`);
    await queryRunner.query(
      `ALTER TABLE "table_settings" DROP COLUMN "fog_memory"`,
    );
  }
}
