import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenSexAndNameVisibility1765152000000 implements MigrationInterface {
  name = 'AddTokenSexAndNameVisibility1765152000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "token_sex" AS ENUM ('female', 'male', 'other')`,
    );
    await queryRunner.query(`ALTER TABLE "tokens" ADD "sex" "token_sex" NULL`);
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD "name_hidden" boolean NOT NULL DEFAULT false`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "name_hidden"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "sex"`);
    await queryRunner.query(`DROP TYPE "token_sex"`);
  }
}
