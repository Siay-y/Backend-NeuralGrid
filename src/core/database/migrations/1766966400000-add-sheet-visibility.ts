import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSheetVisibility1766966400000 implements MigrationInterface {
  name = 'AddSheetVisibility1766966400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "character_sheets" ADD "hidden" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "character_sheets" ADD "name_hidden" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "character_sheets" DROP COLUMN "name_hidden"`,
    );
    await queryRunner.query(
      `ALTER TABLE "character_sheets" DROP COLUMN "hidden"`,
    );
  }
}
