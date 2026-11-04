import { MigrationInterface, QueryRunner } from 'typeorm';

/** ایندکس‌های جدول‌های پاسخ (Postgres) — قرینهٔ نسخهٔ SQLite. */
export class PgAddResponseIndexes1800000000031 implements MigrationInterface {
  name = 'PgAddResponseIndexes1800000000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_responses_form_created" ON "responses" ("formVersionId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_responses_publication" ON "responses" ("publicationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_responses_respondent" ON "responses" ("respondentKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_responses_status_submitted" ON "responses" ("status", "submittedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_answer_flat_response" ON "answer_flat" ("responseId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_answer_flat_question_choice" ON "answer_flat" ("questionId", "choiceId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_answer_flat_question_choice"`);
    await queryRunner.query(`DROP INDEX "IDX_answer_flat_response"`);
    await queryRunner.query(`DROP INDEX "IDX_responses_status_submitted"`);
    await queryRunner.query(`DROP INDEX "IDX_responses_respondent"`);
    await queryRunner.query(`DROP INDEX "IDX_responses_publication"`);
    await queryRunner.query(`DROP INDEX "IDX_responses_form_created"`);
  }
}
