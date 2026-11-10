import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenIconAndVisibility1764547200000 implements MigrationInterface {
  name = 'AddTokenIconAndVisibility1764547200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tokens" ADD "icon" varchar(48) NULL`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "hidden" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "hidden"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "icon"`);
  }
}
