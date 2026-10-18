import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * وضعیت پایه‌ی اسکیما، تولیدشده از روی موجودیت‌ها.
 *
 * نصب‌های موجود این مهاجرت را «اعمال‌شده» ثبت می‌کنند بدون اجرا (جدول‌ها
 * از قبل هستند)؛ نصب تازه آن را واقعا اجرا می‌کند.
 */
export class Baseline1788846783305 implements MigrationInterface {
  name = 'Baseline1788846783305';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "publications" ("id" varchar PRIMARY KEY NOT NULL, "formId" varchar NOT NULL, "type" varchar CHECK( "type" IN ('link','qr','embed','popup','sms','email','kiosk','app','portal','interviewer','social') ) NOT NULL DEFAULT ('link'), "authMode" varchar CHECK( "authMode" IN ('none','param','link','password','otp','oauth','ldap') ) NOT NULL DEFAULT ('none'), "token" varchar(80) NOT NULL, "slug" varchar(80), "tags" text NOT NULL DEFAULT ('[]'), "customDomain" varchar(240), "expiresAt" datetime, "quota" integer, "config" text NOT NULL DEFAULT ('{}'), "viewCount" integer NOT NULL DEFAULT (0), "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_30e8d9fc020f2dc0d6a6b112a8c" UNIQUE ("token"), CONSTRAINT "UQ_9616efcd2c6486fbb02e882af56" UNIQUE ("slug"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "plan_policies" ("id" varchar PRIMARY KEY NOT NULL, "planCode" varchar CHECK( "planCode" IN ('free','pro','org','enterprise') ) NOT NULL, "limits" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_257de8db68f7a67b309123dce4a" UNIQUE ("planCode"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "planCode" varchar CHECK( "planCode" IN ('free','pro','org','enterprise') ) NOT NULL DEFAULT ('free'), "expiresAt" datetime, "isActive" boolean NOT NULL DEFAULT (1), "overrides" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "usage_counters" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "periodKey" varchar(20) NOT NULL, "metric" varchar(60) NOT NULL, "used" integer NOT NULL DEFAULT (0), "limitValue" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_usage_org_period_metric" UNIQUE ("organizationId", "periodKey", "metric"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "fullName" varchar(120) NOT NULL, "email" varchar(120) NOT NULL, "passwordHash" varchar(255) NOT NULL, "isSuperAdmin" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_users" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "userId" varchar NOT NULL, "role" varchar CHECK( "role" IN ('owner','admin','editor','analyst','viewer') ) NOT NULL DEFAULT ('owner'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_organization_user" UNIQUE ("organizationId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(180) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(180) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "forms" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "title" varchar(220) NOT NULL, "slug" varchar(220) NOT NULL, "status" varchar CHECK( "status" IN ('draft','active','closed','archived') ) NOT NULL DEFAULT ('draft'), "settings" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_beb11480ce7ba6813fe893723a1" UNIQUE ("slug"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "form_versions" ("id" varchar PRIMARY KEY NOT NULL, "formId" varchar NOT NULL, "version" integer NOT NULL, "structure" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_form_versions_form_version" UNIQUE ("formId", "version"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "response_comments" ("id" varchar PRIMARY KEY NOT NULL, "responseId" varchar NOT NULL, "authorName" varchar(120) NOT NULL, "body" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "responses" ("id" varchar PRIMARY KEY NOT NULL, "formVersionId" varchar NOT NULL, "publicationId" varchar NOT NULL, "respondentKey" varchar(120), "status" varchar CHECK( "status" IN ('partial','completed') ) NOT NULL DEFAULT ('completed'), "startedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "submittedAt" datetime, "durationSeconds" integer, "meta" text NOT NULL DEFAULT ('{}'), "answers" text NOT NULL DEFAULT ('{}'), "scores" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "answer_flat" ("id" varchar PRIMARY KEY NOT NULL, "responseId" varchar NOT NULL, "questionId" varchar(80) NOT NULL, "valueText" text, "valueNumber" double precision, "choiceId" varchar(80))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(120) NOT NULL, "keyPrefix" varchar(120) NOT NULL, "keyHash" varchar(120) NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "scopes" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_3ee8ea3e49f8f437c17219dad66" UNIQUE ("keyPrefix"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "action" varchar(120) NOT NULL, "actorType" varchar(120) NOT NULL, "actorId" varchar(120), "payload" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_lists" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(160) NOT NULL, "tags" text NOT NULL DEFAULT ('[]'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "contacts" ("id" varchar PRIMARY KEY NOT NULL, "listId" varchar NOT NULL, "fullName" varchar(160), "mobile" varchar(20), "email" varchar(180), "variables" text NOT NULL DEFAULT ('{}'), "tags" text NOT NULL DEFAULT ('[]'), "unsubscribed" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0fa3f31879604eee93095dec2b" ON "contacts" ("listId", "email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2d627ce0e4f6664f1775e1321" ON "contacts" ("listId", "mobile") `,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_sources" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "listId" varchar NOT NULL, "name" varchar(160) NOT NULL, "url" text NOT NULL, "method" varchar(10) NOT NULL DEFAULT ('GET'), "headers" text NOT NULL DEFAULT ('{}'), "body" text NOT NULL DEFAULT ('{}'), "itemsPath" varchar(200) NOT NULL DEFAULT (''), "mapping" text NOT NULL DEFAULT ('{}'), "isActive" boolean NOT NULL DEFAULT (1), "lastSyncedAt" datetime, "lastResult" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "dashboards" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(160) NOT NULL, "widgets" text NOT NULL DEFAULT ('[]'), "isPublic" boolean NOT NULL DEFAULT (0), "publicToken" varchar(80), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_4df2a7637680e200e00547b471c" UNIQUE ("publicToken"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9236a2cd3f6652b5e6fb93ebf1" ON "dashboards" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_logs" ("id" varchar PRIMARY KEY NOT NULL, "publicationId" varchar NOT NULL, "channel" varchar(30) NOT NULL, "status" varchar(20) NOT NULL, "payload" text NOT NULL DEFAULT ('{}'), "providerMessage" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "identity_providers" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "type" varchar CHECK( "type" IN ('oauth','ldap') ) NOT NULL, "name" varchar(160) NOT NULL, "config" text NOT NULL DEFAULT ('{}'), "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "interviewer_quotas" ("id" varchar PRIMARY KEY NOT NULL, "publicationId" varchar NOT NULL, "interviewerName" varchar(120) NOT NULL, "assignedQuota" integer NOT NULL DEFAULT (0), "usedQuota" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "invoiceNo" varchar(80) NOT NULL, "status" varchar CHECK( "status" IN ('draft','issued','paid','canceled') ) NOT NULL DEFAULT ('draft'), "amount" bigint NOT NULL DEFAULT (0), "metadata" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_1a94a2eb122d90baad7ca28f654" UNIQUE ("invoiceNo"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kiosk_sessions" ("id" varchar PRIMARY KEY NOT NULL, "publicationId" varchar NOT NULL, "deviceCode" varchar(80) NOT NULL, "isLocked" boolean NOT NULL DEFAULT (1), "lastSyncPayload" text NOT NULL DEFAULT ('{}'), "lastSyncedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "onprem_licenses" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "licenseKey" varchar(120) NOT NULL, "capabilities" text NOT NULL DEFAULT ('{}'), "expiresAt" datetime, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_da74b856e5b4f197ad976a1cc6f" UNIQUE ("licenseKey"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_challenges" ("id" varchar PRIMARY KEY NOT NULL, "publicationId" varchar NOT NULL, "destination" varchar(180) NOT NULL, "codeHash" varchar(128) NOT NULL, "expiresAt" datetime NOT NULL, "attempts" integer NOT NULL DEFAULT (0), "consumed" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f2ff95d0b9abe88a66923794b" ON "otp_challenges" ("publicationId", "destination") `,
    );
    await queryRunner.query(
      `CREATE TABLE "queued_jobs" ("id" varchar PRIMARY KEY NOT NULL, "kind" varchar(60) NOT NULL, "payload" text NOT NULL DEFAULT ('{}'), "status" varchar CHECK( "status" IN ('pending','running','done','failed') ) NOT NULL DEFAULT ('pending'), "attempts" integer NOT NULL DEFAULT (0), "maxAttempts" integer NOT NULL DEFAULT (3), "runAfter" datetime NOT NULL, "lastError" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0f7c11bc89023854134748a6f4" ON "queued_jobs" ("status", "runAfter") `,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" varchar PRIMARY KEY NOT NULL, "invoiceId" varchar NOT NULL, "gateway" varchar(60) NOT NULL, "status" varchar CHECK( "status" IN ('pending','success','failed') ) NOT NULL DEFAULT ('pending'), "amount" bigint NOT NULL DEFAULT (0), "referenceCode" varchar(120), "authority" varchar(160), "metadata" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_settings" ("id" varchar(32) PRIMARY KEY NOT NULL, "footerEnabled" boolean NOT NULL DEFAULT (1), "footerText" varchar(200) NOT NULL DEFAULT (''), "footerUrl" varchar(300) NOT NULL DEFAULT (''), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "saved_filters" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "name" varchar(160) NOT NULL, "definition" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "event" varchar(120) NOT NULL, "targetUrl" varchar(500) NOT NULL, "secret" varchar(120) NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_integrations" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "botToken" varchar(120) NOT NULL, "webhookToken" varchar(64), "botUsername" varchar(64), "isActive" boolean NOT NULL DEFAULT (1), "lastError" varchar(300), "lastSentAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_2dd06ecaffe10d14f41ccde1cf7" UNIQUE ("workspaceId"), CONSTRAINT "UQ_c9424ad112f8672d6c58515d073" UNIQUE ("webhookToken"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_recipients" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "formId" varchar, "chatId" varchar(64) NOT NULL, "label" varchar(120) NOT NULL DEFAULT (''), "scoreThreshold" double precision, "isActive" boolean NOT NULL DEFAULT (1), "notifyOnResponse" boolean NOT NULL DEFAULT (1), "digest" varchar(16) NOT NULL DEFAULT ('none'), "lastDigestAt" datetime, "lastError" varchar(300), "lastSentAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1261cbf36f4317a5c16b685d58" ON "telegram_recipients" ("workspaceId", "formId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_link_codes" ("id" varchar PRIMARY KEY NOT NULL, "code" varchar(16) NOT NULL, "workspaceId" varchar NOT NULL, "formId" varchar, "label" varchar(120) NOT NULL DEFAULT (''), "expiresAt" datetime NOT NULL, "maxUses" integer DEFAULT (1), "useCount" integer NOT NULL DEFAULT (0), "usedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ffc6d0c8ce6da8035fa1e51a46" ON "telegram_link_codes" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_publications" ("id" varchar PRIMARY KEY NOT NULL, "formId" varchar NOT NULL, "type" varchar CHECK( "type" IN ('link','qr','embed','popup','sms','email','kiosk','app','portal','interviewer','social') ) NOT NULL DEFAULT ('link'), "authMode" varchar CHECK( "authMode" IN ('none','param','link','password','otp','oauth','ldap') ) NOT NULL DEFAULT ('none'), "token" varchar(80) NOT NULL, "slug" varchar(80), "tags" text NOT NULL DEFAULT ('[]'), "customDomain" varchar(240), "expiresAt" datetime, "quota" integer, "config" text NOT NULL DEFAULT ('{}'), "viewCount" integer NOT NULL DEFAULT (0), "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_30e8d9fc020f2dc0d6a6b112a8c" UNIQUE ("token"), CONSTRAINT "UQ_9616efcd2c6486fbb02e882af56" UNIQUE ("slug"), CONSTRAINT "FK_4b5bad01d9f4e5a1e15b65024fe" FOREIGN KEY ("formId") REFERENCES "forms" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_publications"("id", "formId", "type", "authMode", "token", "slug", "tags", "customDomain", "expiresAt", "quota", "config", "viewCount", "isActive", "createdAt") SELECT "id", "formId", "type", "authMode", "token", "slug", "tags", "customDomain", "expiresAt", "quota", "config", "viewCount", "isActive", "createdAt" FROM "publications"`,
    );
    await queryRunner.query(`DROP TABLE "publications"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_publications" RENAME TO "publications"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_subscriptions" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "planCode" varchar CHECK( "planCode" IN ('free','pro','org','enterprise') ) NOT NULL DEFAULT ('free'), "expiresAt" datetime, "isActive" boolean NOT NULL DEFAULT (1), "overrides" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_a7a84c705f3e8e4fbd497cfb119" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_subscriptions"("id", "organizationId", "planCode", "expiresAt", "isActive", "overrides", "createdAt", "updatedAt") SELECT "id", "organizationId", "planCode", "expiresAt", "isActive", "overrides", "createdAt", "updatedAt" FROM "subscriptions"`,
    );
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_subscriptions" RENAME TO "subscriptions"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_usage_counters" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "periodKey" varchar(20) NOT NULL, "metric" varchar(60) NOT NULL, "used" integer NOT NULL DEFAULT (0), "limitValue" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_usage_org_period_metric" UNIQUE ("organizationId", "periodKey", "metric"), CONSTRAINT "FK_ab632d5e789ef1131dddddb9c57" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_usage_counters"("id", "organizationId", "periodKey", "metric", "used", "limitValue", "createdAt", "updatedAt") SELECT "id", "organizationId", "periodKey", "metric", "used", "limitValue", "createdAt", "updatedAt" FROM "usage_counters"`,
    );
    await queryRunner.query(`DROP TABLE "usage_counters"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_usage_counters" RENAME TO "usage_counters"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_organization_users" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "userId" varchar NOT NULL, "role" varchar CHECK( "role" IN ('owner','admin','editor','analyst','viewer') ) NOT NULL DEFAULT ('owner'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_organization_user" UNIQUE ("organizationId", "userId"), CONSTRAINT "FK_26f83117dea41b00841385b9821" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c4a44a1be146c6c6197f82725d8" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_organization_users"("id", "organizationId", "userId", "role", "createdAt") SELECT "id", "organizationId", "userId", "role", "createdAt" FROM "organization_users"`,
    );
    await queryRunner.query(`DROP TABLE "organization_users"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_organization_users" RENAME TO "organization_users"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_workspaces" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(180) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_8f75913774150a5d5dde56513b1" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_workspaces"("id", "organizationId", "name", "createdAt", "updatedAt") SELECT "id", "organizationId", "name", "createdAt", "updatedAt" FROM "workspaces"`,
    );
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_workspaces" RENAME TO "workspaces"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_forms" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "title" varchar(220) NOT NULL, "slug" varchar(220) NOT NULL, "status" varchar CHECK( "status" IN ('draft','active','closed','archived') ) NOT NULL DEFAULT ('draft'), "settings" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_beb11480ce7ba6813fe893723a1" UNIQUE ("slug"), CONSTRAINT "FK_468fdaa078124f307be065ce24d" FOREIGN KEY ("workspaceId") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_forms"("id", "workspaceId", "title", "slug", "status", "settings", "createdAt", "updatedAt") SELECT "id", "workspaceId", "title", "slug", "status", "settings", "createdAt", "updatedAt" FROM "forms"`,
    );
    await queryRunner.query(`DROP TABLE "forms"`);
    await queryRunner.query(`ALTER TABLE "temporary_forms" RENAME TO "forms"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_form_versions" ("id" varchar PRIMARY KEY NOT NULL, "formId" varchar NOT NULL, "version" integer NOT NULL, "structure" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_form_versions_form_version" UNIQUE ("formId", "version"), CONSTRAINT "FK_4f22a570ecaca0bee93bbf1a3c7" FOREIGN KEY ("formId") REFERENCES "forms" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_form_versions"("id", "formId", "version", "structure", "createdAt") SELECT "id", "formId", "version", "structure", "createdAt" FROM "form_versions"`,
    );
    await queryRunner.query(`DROP TABLE "form_versions"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_form_versions" RENAME TO "form_versions"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_response_comments" ("id" varchar PRIMARY KEY NOT NULL, "responseId" varchar NOT NULL, "authorName" varchar(120) NOT NULL, "body" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_d8d1f975fff62ff3f8afe5a793d" FOREIGN KEY ("responseId") REFERENCES "responses" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_response_comments"("id", "responseId", "authorName", "body", "createdAt") SELECT "id", "responseId", "authorName", "body", "createdAt" FROM "response_comments"`,
    );
    await queryRunner.query(`DROP TABLE "response_comments"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_response_comments" RENAME TO "response_comments"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_responses" ("id" varchar PRIMARY KEY NOT NULL, "formVersionId" varchar NOT NULL, "publicationId" varchar NOT NULL, "respondentKey" varchar(120), "status" varchar CHECK( "status" IN ('partial','completed') ) NOT NULL DEFAULT ('completed'), "startedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "submittedAt" datetime, "durationSeconds" integer, "meta" text NOT NULL DEFAULT ('{}'), "answers" text NOT NULL DEFAULT ('{}'), "scores" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_b58349b3b9ea83108c1bb2dc012" FOREIGN KEY ("formVersionId") REFERENCES "form_versions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c85752240270f4947ce28037e19" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_responses"("id", "formVersionId", "publicationId", "respondentKey", "status", "startedAt", "submittedAt", "durationSeconds", "meta", "answers", "scores", "createdAt") SELECT "id", "formVersionId", "publicationId", "respondentKey", "status", "startedAt", "submittedAt", "durationSeconds", "meta", "answers", "scores", "createdAt" FROM "responses"`,
    );
    await queryRunner.query(`DROP TABLE "responses"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_responses" RENAME TO "responses"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_answer_flat" ("id" varchar PRIMARY KEY NOT NULL, "responseId" varchar NOT NULL, "questionId" varchar(80) NOT NULL, "valueText" text, "valueNumber" double precision, "choiceId" varchar(80), CONSTRAINT "FK_ea89813d86f384a64823727d782" FOREIGN KEY ("responseId") REFERENCES "responses" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_answer_flat"("id", "responseId", "questionId", "valueText", "valueNumber", "choiceId") SELECT "id", "responseId", "questionId", "valueText", "valueNumber", "choiceId" FROM "answer_flat"`,
    );
    await queryRunner.query(`DROP TABLE "answer_flat"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_answer_flat" RENAME TO "answer_flat"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_contact_lists" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(160) NOT NULL, "tags" text NOT NULL DEFAULT ('[]'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_c72ebfbd91b47b9a64ced469d10" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_contact_lists"("id", "organizationId", "name", "tags", "createdAt", "updatedAt") SELECT "id", "organizationId", "name", "tags", "createdAt", "updatedAt" FROM "contact_lists"`,
    );
    await queryRunner.query(`DROP TABLE "contact_lists"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_contact_lists" RENAME TO "contact_lists"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_0fa3f31879604eee93095dec2b"`);
    await queryRunner.query(`DROP INDEX "IDX_d2d627ce0e4f6664f1775e1321"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_contacts" ("id" varchar PRIMARY KEY NOT NULL, "listId" varchar NOT NULL, "fullName" varchar(160), "mobile" varchar(20), "email" varchar(180), "variables" text NOT NULL DEFAULT ('{}'), "tags" text NOT NULL DEFAULT ('[]'), "unsubscribed" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_6ab3893f9fa3ed9ef4284c16909" FOREIGN KEY ("listId") REFERENCES "contact_lists" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_contacts"("id", "listId", "fullName", "mobile", "email", "variables", "tags", "unsubscribed", "createdAt", "updatedAt") SELECT "id", "listId", "fullName", "mobile", "email", "variables", "tags", "unsubscribed", "createdAt", "updatedAt" FROM "contacts"`,
    );
    await queryRunner.query(`DROP TABLE "contacts"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_contacts" RENAME TO "contacts"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0fa3f31879604eee93095dec2b" ON "contacts" ("listId", "email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2d627ce0e4f6664f1775e1321" ON "contacts" ("listId", "mobile") `,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_contact_sources" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "listId" varchar NOT NULL, "name" varchar(160) NOT NULL, "url" text NOT NULL, "method" varchar(10) NOT NULL DEFAULT ('GET'), "headers" text NOT NULL DEFAULT ('{}'), "body" text NOT NULL DEFAULT ('{}'), "itemsPath" varchar(200) NOT NULL DEFAULT (''), "mapping" text NOT NULL DEFAULT ('{}'), "isActive" boolean NOT NULL DEFAULT (1), "lastSyncedAt" datetime, "lastResult" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_5c1edb0c90e6a1a946a49de7929" FOREIGN KEY ("listId") REFERENCES "contact_lists" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_contact_sources"("id", "organizationId", "listId", "name", "url", "method", "headers", "body", "itemsPath", "mapping", "isActive", "lastSyncedAt", "lastResult", "createdAt", "updatedAt") SELECT "id", "organizationId", "listId", "name", "url", "method", "headers", "body", "itemsPath", "mapping", "isActive", "lastSyncedAt", "lastResult", "createdAt", "updatedAt" FROM "contact_sources"`,
    );
    await queryRunner.query(`DROP TABLE "contact_sources"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_contact_sources" RENAME TO "contact_sources"`,
    );
    await queryRunner.query(
      `CREATE TABLE "temporary_delivery_logs" ("id" varchar PRIMARY KEY NOT NULL, "publicationId" varchar NOT NULL, "channel" varchar(30) NOT NULL, "status" varchar(20) NOT NULL, "payload" text NOT NULL DEFAULT ('{}'), "providerMessage" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_3c7334b45331b40a26fd5a3445e" FOREIGN KEY ("publicationId") REFERENCES "publications" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_delivery_logs"("id", "publicationId", "channel", "status", "payload", "providerMessage", "createdAt") SELECT "id", "publicationId", "channel", "status", "payload", "providerMessage", "createdAt" FROM "delivery_logs"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_logs"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_delivery_logs" RENAME TO "delivery_logs"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "delivery_logs" RENAME TO "temporary_delivery_logs"`,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_logs" ("id" varchar PRIMARY KEY NOT NULL, "publicationId" varchar NOT NULL, "channel" varchar(30) NOT NULL, "status" varchar(20) NOT NULL, "payload" text NOT NULL DEFAULT ('{}'), "providerMessage" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "delivery_logs"("id", "publicationId", "channel", "status", "payload", "providerMessage", "createdAt") SELECT "id", "publicationId", "channel", "status", "payload", "providerMessage", "createdAt" FROM "temporary_delivery_logs"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_delivery_logs"`);
    await queryRunner.query(
      `ALTER TABLE "contact_sources" RENAME TO "temporary_contact_sources"`,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_sources" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "listId" varchar NOT NULL, "name" varchar(160) NOT NULL, "url" text NOT NULL, "method" varchar(10) NOT NULL DEFAULT ('GET'), "headers" text NOT NULL DEFAULT ('{}'), "body" text NOT NULL DEFAULT ('{}'), "itemsPath" varchar(200) NOT NULL DEFAULT (''), "mapping" text NOT NULL DEFAULT ('{}'), "isActive" boolean NOT NULL DEFAULT (1), "lastSyncedAt" datetime, "lastResult" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "contact_sources"("id", "organizationId", "listId", "name", "url", "method", "headers", "body", "itemsPath", "mapping", "isActive", "lastSyncedAt", "lastResult", "createdAt", "updatedAt") SELECT "id", "organizationId", "listId", "name", "url", "method", "headers", "body", "itemsPath", "mapping", "isActive", "lastSyncedAt", "lastResult", "createdAt", "updatedAt" FROM "temporary_contact_sources"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_contact_sources"`);
    await queryRunner.query(`DROP INDEX "IDX_d2d627ce0e4f6664f1775e1321"`);
    await queryRunner.query(`DROP INDEX "IDX_0fa3f31879604eee93095dec2b"`);
    await queryRunner.query(
      `ALTER TABLE "contacts" RENAME TO "temporary_contacts"`,
    );
    await queryRunner.query(
      `CREATE TABLE "contacts" ("id" varchar PRIMARY KEY NOT NULL, "listId" varchar NOT NULL, "fullName" varchar(160), "mobile" varchar(20), "email" varchar(180), "variables" text NOT NULL DEFAULT ('{}'), "tags" text NOT NULL DEFAULT ('[]'), "unsubscribed" boolean NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "contacts"("id", "listId", "fullName", "mobile", "email", "variables", "tags", "unsubscribed", "createdAt", "updatedAt") SELECT "id", "listId", "fullName", "mobile", "email", "variables", "tags", "unsubscribed", "createdAt", "updatedAt" FROM "temporary_contacts"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_contacts"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_d2d627ce0e4f6664f1775e1321" ON "contacts" ("listId", "mobile") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0fa3f31879604eee93095dec2b" ON "contacts" ("listId", "email") `,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_lists" RENAME TO "temporary_contact_lists"`,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_lists" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(160) NOT NULL, "tags" text NOT NULL DEFAULT ('[]'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "contact_lists"("id", "organizationId", "name", "tags", "createdAt", "updatedAt") SELECT "id", "organizationId", "name", "tags", "createdAt", "updatedAt" FROM "temporary_contact_lists"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_contact_lists"`);
    await queryRunner.query(
      `ALTER TABLE "answer_flat" RENAME TO "temporary_answer_flat"`,
    );
    await queryRunner.query(
      `CREATE TABLE "answer_flat" ("id" varchar PRIMARY KEY NOT NULL, "responseId" varchar NOT NULL, "questionId" varchar(80) NOT NULL, "valueText" text, "valueNumber" double precision, "choiceId" varchar(80))`,
    );
    await queryRunner.query(
      `INSERT INTO "answer_flat"("id", "responseId", "questionId", "valueText", "valueNumber", "choiceId") SELECT "id", "responseId", "questionId", "valueText", "valueNumber", "choiceId" FROM "temporary_answer_flat"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_answer_flat"`);
    await queryRunner.query(
      `ALTER TABLE "responses" RENAME TO "temporary_responses"`,
    );
    await queryRunner.query(
      `CREATE TABLE "responses" ("id" varchar PRIMARY KEY NOT NULL, "formVersionId" varchar NOT NULL, "publicationId" varchar NOT NULL, "respondentKey" varchar(120), "status" varchar CHECK( "status" IN ('partial','completed') ) NOT NULL DEFAULT ('completed'), "startedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "submittedAt" datetime, "durationSeconds" integer, "meta" text NOT NULL DEFAULT ('{}'), "answers" text NOT NULL DEFAULT ('{}'), "scores" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "responses"("id", "formVersionId", "publicationId", "respondentKey", "status", "startedAt", "submittedAt", "durationSeconds", "meta", "answers", "scores", "createdAt") SELECT "id", "formVersionId", "publicationId", "respondentKey", "status", "startedAt", "submittedAt", "durationSeconds", "meta", "answers", "scores", "createdAt" FROM "temporary_responses"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_responses"`);
    await queryRunner.query(
      `ALTER TABLE "response_comments" RENAME TO "temporary_response_comments"`,
    );
    await queryRunner.query(
      `CREATE TABLE "response_comments" ("id" varchar PRIMARY KEY NOT NULL, "responseId" varchar NOT NULL, "authorName" varchar(120) NOT NULL, "body" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "response_comments"("id", "responseId", "authorName", "body", "createdAt") SELECT "id", "responseId", "authorName", "body", "createdAt" FROM "temporary_response_comments"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_response_comments"`);
    await queryRunner.query(
      `ALTER TABLE "form_versions" RENAME TO "temporary_form_versions"`,
    );
    await queryRunner.query(
      `CREATE TABLE "form_versions" ("id" varchar PRIMARY KEY NOT NULL, "formId" varchar NOT NULL, "version" integer NOT NULL, "structure" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_form_versions_form_version" UNIQUE ("formId", "version"))`,
    );
    await queryRunner.query(
      `INSERT INTO "form_versions"("id", "formId", "version", "structure", "createdAt") SELECT "id", "formId", "version", "structure", "createdAt" FROM "temporary_form_versions"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_form_versions"`);
    await queryRunner.query(`ALTER TABLE "forms" RENAME TO "temporary_forms"`);
    await queryRunner.query(
      `CREATE TABLE "forms" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "title" varchar(220) NOT NULL, "slug" varchar(220) NOT NULL, "status" varchar CHECK( "status" IN ('draft','active','closed','archived') ) NOT NULL DEFAULT ('draft'), "settings" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_beb11480ce7ba6813fe893723a1" UNIQUE ("slug"))`,
    );
    await queryRunner.query(
      `INSERT INTO "forms"("id", "workspaceId", "title", "slug", "status", "settings", "createdAt", "updatedAt") SELECT "id", "workspaceId", "title", "slug", "status", "settings", "createdAt", "updatedAt" FROM "temporary_forms"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_forms"`);
    await queryRunner.query(
      `ALTER TABLE "workspaces" RENAME TO "temporary_workspaces"`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "name" varchar(180) NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "workspaces"("id", "organizationId", "name", "createdAt", "updatedAt") SELECT "id", "organizationId", "name", "createdAt", "updatedAt" FROM "temporary_workspaces"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_workspaces"`);
    await queryRunner.query(
      `ALTER TABLE "organization_users" RENAME TO "temporary_organization_users"`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_users" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "userId" varchar NOT NULL, "role" varchar CHECK( "role" IN ('owner','admin','editor','analyst','viewer') ) NOT NULL DEFAULT ('owner'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_organization_user" UNIQUE ("organizationId", "userId"))`,
    );
    await queryRunner.query(
      `INSERT INTO "organization_users"("id", "organizationId", "userId", "role", "createdAt") SELECT "id", "organizationId", "userId", "role", "createdAt" FROM "temporary_organization_users"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_organization_users"`);
    await queryRunner.query(
      `ALTER TABLE "usage_counters" RENAME TO "temporary_usage_counters"`,
    );
    await queryRunner.query(
      `CREATE TABLE "usage_counters" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "periodKey" varchar(20) NOT NULL, "metric" varchar(60) NOT NULL, "used" integer NOT NULL DEFAULT (0), "limitValue" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "uq_usage_org_period_metric" UNIQUE ("organizationId", "periodKey", "metric"))`,
    );
    await queryRunner.query(
      `INSERT INTO "usage_counters"("id", "organizationId", "periodKey", "metric", "used", "limitValue", "createdAt", "updatedAt") SELECT "id", "organizationId", "periodKey", "metric", "used", "limitValue", "createdAt", "updatedAt" FROM "temporary_usage_counters"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_usage_counters"`);
    await queryRunner.query(
      `ALTER TABLE "subscriptions" RENAME TO "temporary_subscriptions"`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "planCode" varchar CHECK( "planCode" IN ('free','pro','org','enterprise') ) NOT NULL DEFAULT ('free'), "expiresAt" datetime, "isActive" boolean NOT NULL DEFAULT (1), "overrides" text NOT NULL DEFAULT ('{}'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `INSERT INTO "subscriptions"("id", "organizationId", "planCode", "expiresAt", "isActive", "overrides", "createdAt", "updatedAt") SELECT "id", "organizationId", "planCode", "expiresAt", "isActive", "overrides", "createdAt", "updatedAt" FROM "temporary_subscriptions"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_subscriptions"`);
    await queryRunner.query(
      `ALTER TABLE "publications" RENAME TO "temporary_publications"`,
    );
    await queryRunner.query(
      `CREATE TABLE "publications" ("id" varchar PRIMARY KEY NOT NULL, "formId" varchar NOT NULL, "type" varchar CHECK( "type" IN ('link','qr','embed','popup','sms','email','kiosk','app','portal','interviewer','social') ) NOT NULL DEFAULT ('link'), "authMode" varchar CHECK( "authMode" IN ('none','param','link','password','otp','oauth','ldap') ) NOT NULL DEFAULT ('none'), "token" varchar(80) NOT NULL, "slug" varchar(80), "tags" text NOT NULL DEFAULT ('[]'), "customDomain" varchar(240), "expiresAt" datetime, "quota" integer, "config" text NOT NULL DEFAULT ('{}'), "viewCount" integer NOT NULL DEFAULT (0), "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_30e8d9fc020f2dc0d6a6b112a8c" UNIQUE ("token"), CONSTRAINT "UQ_9616efcd2c6486fbb02e882af56" UNIQUE ("slug"))`,
    );
    await queryRunner.query(
      `INSERT INTO "publications"("id", "formId", "type", "authMode", "token", "slug", "tags", "customDomain", "expiresAt", "quota", "config", "viewCount", "isActive", "createdAt") SELECT "id", "formId", "type", "authMode", "token", "slug", "tags", "customDomain", "expiresAt", "quota", "config", "viewCount", "isActive", "createdAt" FROM "temporary_publications"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_publications"`);
    await queryRunner.query(`DROP INDEX "IDX_ffc6d0c8ce6da8035fa1e51a46"`);
    await queryRunner.query(`DROP TABLE "telegram_link_codes"`);
    await queryRunner.query(`DROP INDEX "IDX_1261cbf36f4317a5c16b685d58"`);
    await queryRunner.query(`DROP TABLE "telegram_recipients"`);
    await queryRunner.query(`DROP TABLE "telegram_integrations"`);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "saved_filters"`);
    await queryRunner.query(`DROP TABLE "platform_settings"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP INDEX "IDX_0f7c11bc89023854134748a6f4"`);
    await queryRunner.query(`DROP TABLE "queued_jobs"`);
    await queryRunner.query(`DROP INDEX "IDX_2f2ff95d0b9abe88a66923794b"`);
    await queryRunner.query(`DROP TABLE "otp_challenges"`);
    await queryRunner.query(`DROP TABLE "onprem_licenses"`);
    await queryRunner.query(`DROP TABLE "kiosk_sessions"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "interviewer_quotas"`);
    await queryRunner.query(`DROP TABLE "identity_providers"`);
    await queryRunner.query(`DROP TABLE "delivery_logs"`);
    await queryRunner.query(`DROP INDEX "IDX_9236a2cd3f6652b5e6fb93ebf1"`);
    await queryRunner.query(`DROP TABLE "dashboards"`);
    await queryRunner.query(`DROP TABLE "contact_sources"`);
    await queryRunner.query(`DROP INDEX "IDX_d2d627ce0e4f6664f1775e1321"`);
    await queryRunner.query(`DROP INDEX "IDX_0fa3f31879604eee93095dec2b"`);
    await queryRunner.query(`DROP TABLE "contacts"`);
    await queryRunner.query(`DROP TABLE "contact_lists"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "answer_flat"`);
    await queryRunner.query(`DROP TABLE "responses"`);
    await queryRunner.query(`DROP TABLE "response_comments"`);
    await queryRunner.query(`DROP TABLE "form_versions"`);
    await queryRunner.query(`DROP TABLE "forms"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TABLE "organization_users"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "usage_counters"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TABLE "plan_policies"`);
    await queryRunner.query(`DROP TABLE "publications"`);
  }
}
