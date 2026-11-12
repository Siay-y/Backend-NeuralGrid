import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenLight1768867200000 implements MigrationInterface {
  name = 'AddTokenLight1768867200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "emits_light" boolean NOT NULL DEFAULT true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "emits_light"`);
  }
}
