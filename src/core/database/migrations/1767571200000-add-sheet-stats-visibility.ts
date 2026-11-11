import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSheetStatsVisibility1767571200000 implements MigrationInterface {
  name = 'AddSheetStatsVisibility1767571200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "character_sheets" ADD "stats_hidden" boolean NOT NULL DEFAULT true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "character_sheets" DROP COLUMN "stats_hidden"`,
    );
  }
}
