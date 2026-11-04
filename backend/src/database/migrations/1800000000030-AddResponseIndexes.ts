import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ایندکس‌های جدول‌های پاسخ (SQLite).
 *
 * هر سه ایندکس، مسیرِ گرمِ گزارش‌گیری را از «اسکنِ کاملِ جدول» به جست‌وجوی
 * ایندکسی می‌برند: فهرستِ پاسخ‌های یک فرم به ترتیبِ زمان، پاسخ‌های یک کانالِ
 * انتشار، پاسخ‌های یک پاسخ‌دهنده، و شمارشِ تکمیل‌شده‌ها در بازه.
 */
export class AddResponseIndexes1800000000030 implements MigrationInterface {
  name = 'AddResponseIndexes1800000000030';

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
