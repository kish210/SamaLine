import { MigrationInterface, QueryRunner } from 'typeorm';

export class PgBaseline1788878200721 implements MigrationInterface {
  name = 'PgBaseline1788878200721';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."publications_type_enum" AS ENUM('link', 'qr', 'embed', 'popup', 'sms', 'email', 'kiosk', 'app', 'portal', 'interviewer', 'social')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."publications_authmode_enum" AS ENUM('none', 'param', 'link', 'password', 'otp', 'oauth', 'ldap')`,
    );
    await queryRunner.query(
      `CREATE TABLE "publications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "formId" uuid NOT NULL, "type" "public"."publications_type_enum" NOT NULL DEFAULT 'link', "authMode" "public"."publications_authmode_enum" NOT NULL DEFAULT 'none', "token" character varying(80) NOT NULL, "slug" character varying(80), "tags" jsonb NOT NULL DEFAULT '[]', "customDomain" character varying(240), "expiresAt" TIMESTAMP WITH TIME ZONE, "quota" integer, "config" jsonb NOT NULL DEFAULT '{}', "viewCount" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_30e8d9fc020f2dc0d6a6b112a8c" UNIQUE ("token"), CONSTRAINT "UQ_9616efcd2c6486fbb02e882af56" UNIQUE ("slug"), CONSTRAINT "PK_2c4e732b044e09139d2f1065fae" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."plan_policies_plancode_enum" AS ENUM('free', 'pro', 'org', 'enterprise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "plan_policies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "planCode" "public"."plan_policies_plancode_enum" NOT NULL, "limits" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_257de8db68f7a67b309123dce4a" UNIQUE ("planCode"), CONSTRAINT "PK_cf9465c32875f52c8288e8fa9c7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_plancode_enum" AS ENUM('free', 'pro', 'org', 'enterprise')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "planCode" "public"."subscriptions_plancode_enum" NOT NULL DEFAULT 'free', "expiresAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "overrides" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "usage_counters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "periodKey" character varying(20) NOT NULL, "metric" character varying(60) NOT NULL, "used" integer NOT NULL DEFAULT '0', "limitValue" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_usage_org_period_metric" UNIQUE ("organizationId", "periodKey", "metric"), CONSTRAINT "PK_fb39db314fa8fc2b6653f2f4e31" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fullName" character varying(120) NOT NULL, "email" character varying(120) NOT NULL, "passwordHash" character varying(255) NOT NULL, "isSuperAdmin" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_users_role_enum" AS ENUM('owner', 'admin', 'editor', 'analyst', 'viewer')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "userId" uuid NOT NULL, "role" "public"."organization_users_role_enum" NOT NULL DEFAULT 'owner', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_organization_user" UNIQUE ("organizationId", "userId"), CONSTRAINT "PK_af79a22d50256af35812ba60a87" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(180) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workspaces" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "name" character varying(180) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_098656ae401f3e1a4586f47fd8e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."forms_status_enum" AS ENUM('draft', 'active', 'closed', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TABLE "forms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "title" character varying(220) NOT NULL, "slug" character varying(220) NOT NULL, "status" "public"."forms_status_enum" NOT NULL DEFAULT 'draft', "settings" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_beb11480ce7ba6813fe893723a1" UNIQUE ("slug"), CONSTRAINT "PK_ba062fd30b06814a60756f233da" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "form_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "formId" uuid NOT NULL, "version" integer NOT NULL, "structure" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_form_versions_form_version" UNIQUE ("formId", "version"), CONSTRAINT "PK_46dbd35ef6adf11a8684deae1b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "response_comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "responseId" uuid NOT NULL, "authorName" character varying(120) NOT NULL, "body" text NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8f5f0c7e907cd1ab75b1aae8684" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."responses_status_enum" AS ENUM('partial', 'completed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "responses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "formVersionId" uuid NOT NULL, "publicationId" uuid NOT NULL, "respondentKey" character varying(120), "status" "public"."responses_status_enum" NOT NULL DEFAULT 'completed', "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "submittedAt" TIMESTAMP WITH TIME ZONE, "durationSeconds" integer, "meta" jsonb NOT NULL DEFAULT '{}', "answers" jsonb NOT NULL DEFAULT '{}', "scores" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_be3bdac59bd243dff421ad7bf70" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "answer_flat" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "responseId" uuid NOT NULL, "questionId" character varying(80) NOT NULL, "valueText" text, "valueNumber" double precision, "choiceId" character varying(80), CONSTRAINT "PK_83bd214f6b9fa8b7a4e51302fcb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "name" character varying(120) NOT NULL, "keyPrefix" character varying(120) NOT NULL, "keyHash" character varying(120) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "scopes" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3ee8ea3e49f8f437c17219dad66" UNIQUE ("keyPrefix"), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "action" character varying(120) NOT NULL, "actorType" character varying(120) NOT NULL, "actorId" character varying(120), "payload" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_lists" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "name" character varying(160) NOT NULL, "tags" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d9c15bed294d0779669dc7069c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "listId" uuid NOT NULL, "fullName" character varying(160), "mobile" character varying(20), "email" character varying(180), "variables" jsonb NOT NULL DEFAULT '{}', "tags" jsonb NOT NULL DEFAULT '[]', "unsubscribed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0fa3f31879604eee93095dec2b" ON "contacts"  ("listId", "email") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2d627ce0e4f6664f1775e1321" ON "contacts"  ("listId", "mobile") `,
    );
    await queryRunner.query(
      `CREATE TABLE "contact_sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "listId" uuid NOT NULL, "name" character varying(160) NOT NULL, "url" text NOT NULL, "method" character varying(10) NOT NULL DEFAULT 'GET', "headers" jsonb NOT NULL DEFAULT '{}', "body" jsonb NOT NULL DEFAULT '{}', "itemsPath" character varying(200) NOT NULL DEFAULT '', "mapping" jsonb NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "lastResult" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2c19f0b945105d17662143818fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "dashboards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "name" character varying(160) NOT NULL, "widgets" jsonb NOT NULL DEFAULT '[]', "isPublic" boolean NOT NULL DEFAULT false, "publicToken" character varying(80), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4df2a7637680e200e00547b471c" UNIQUE ("publicToken"), CONSTRAINT "PK_1b4b4bc346118e0d335f16c5344" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9236a2cd3f6652b5e6fb93ebf1" ON "dashboards"  ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "delivery_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "publicationId" uuid NOT NULL, "channel" character varying(30) NOT NULL, "status" character varying(20) NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "providerMessage" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c647802ec5e927513f2d0beec47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."identity_providers_type_enum" AS ENUM('oauth', 'ldap')`,
    );
    await queryRunner.query(
      `CREATE TABLE "identity_providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "type" "public"."identity_providers_type_enum" NOT NULL, "name" character varying(160) NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3ac9e77e3690c03f7f25579c8e0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "interviewer_quotas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "publicationId" uuid NOT NULL, "interviewerName" character varying(120) NOT NULL, "assignedQuota" integer NOT NULL DEFAULT '0', "usedQuota" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_87fae72256ba693405769bd0f89" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."invoices_status_enum" AS ENUM('draft', 'issued', 'paid', 'canceled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "invoiceNo" character varying(80) NOT NULL, "status" "public"."invoices_status_enum" NOT NULL DEFAULT 'draft', "amount" bigint NOT NULL DEFAULT '0', "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_1a94a2eb122d90baad7ca28f654" UNIQUE ("invoiceNo"), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "kiosk_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "publicationId" uuid NOT NULL, "deviceCode" character varying(80) NOT NULL, "isLocked" boolean NOT NULL DEFAULT true, "lastSyncPayload" jsonb NOT NULL DEFAULT '{}', "lastSyncedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_97a241c1e4c6dac501cd78ebab1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "onprem_licenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "licenseKey" character varying(120) NOT NULL, "capabilities" jsonb NOT NULL DEFAULT '{}', "expiresAt" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_da74b856e5b4f197ad976a1cc6f" UNIQUE ("licenseKey"), CONSTRAINT "PK_2ac35eb27d11e93940df82ffab2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "otp_challenges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "publicationId" uuid NOT NULL, "destination" character varying(180) NOT NULL, "codeHash" character varying(128) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c34f21df6c8aa51229715452068" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f2ff95d0b9abe88a66923794b" ON "otp_challenges"  ("publicationId", "destination") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."queued_jobs_status_enum" AS ENUM('pending', 'running', 'done', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "queued_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(60) NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "status" "public"."queued_jobs_status_enum" NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "maxAttempts" integer NOT NULL DEFAULT '3', "runAfter" TIMESTAMP WITH TIME ZONE NOT NULL, "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bcc60858de99b50a4d5c951fc90" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0f7c11bc89023854134748a6f4" ON "queued_jobs"  ("status", "runAfter") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'success', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceId" uuid NOT NULL, "gateway" character varying(60) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "amount" bigint NOT NULL DEFAULT '0', "referenceCode" character varying(120), "authority" character varying(160), "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "platform_settings" ("id" character varying(32) NOT NULL, "footerEnabled" boolean NOT NULL DEFAULT true, "footerText" character varying(200) NOT NULL DEFAULT '', "footerUrl" character varying(300) NOT NULL DEFAULT '', "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2934aeb70ec285196dcab4a2e96" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "saved_filters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "name" character varying(160) NOT NULL, "definition" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d30e30ca883a3bd014c9ed983ac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "webhooks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "event" character varying(120) NOT NULL, "targetUrl" character varying(500) NOT NULL, "secret" character varying(120) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_integrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "botToken" character varying(120) NOT NULL, "webhookToken" character varying(64), "botUsername" character varying(64), "isActive" boolean NOT NULL DEFAULT true, "lastError" character varying(300), "lastSentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2dd06ecaffe10d14f41ccde1cf7" UNIQUE ("workspaceId"), CONSTRAINT "UQ_c9424ad112f8672d6c58515d073" UNIQUE ("webhookToken"), CONSTRAINT "PK_9f79cffc524f04b2d62a2cc0d47" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "formId" uuid, "chatId" character varying(64) NOT NULL, "label" character varying(120) NOT NULL DEFAULT '', "scoreThreshold" double precision, "isActive" boolean NOT NULL DEFAULT true, "notifyOnResponse" boolean NOT NULL DEFAULT true, "digest" character varying(16) NOT NULL DEFAULT 'none', "lastDigestAt" TIMESTAMP WITH TIME ZONE, "lastError" character varying(300), "lastSentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fad7bc4c45af7c453bb0a7d1ebe" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1261cbf36f4317a5c16b685d58" ON "telegram_recipients"  ("workspaceId", "formId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "telegram_link_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(16) NOT NULL, "workspaceId" uuid NOT NULL, "formId" uuid, "label" character varying(120) NOT NULL DEFAULT '', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "maxUses" integer DEFAULT '1', "useCount" integer NOT NULL DEFAULT '0', "usedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b47eff84719ed2ea18041258c23" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ffc6d0c8ce6da8035fa1e51a46" ON "telegram_link_codes"  ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "portals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "slug" character varying(80) NOT NULL, "title" character varying(160) NOT NULL, "description" text NOT NULL DEFAULT '', "formIds" jsonb NOT NULL DEFAULT '[]', "logoUrl" character varying(500) NOT NULL DEFAULT '', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_85b8f3d841e5461991291c91706" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f437df460ca595ccedfb080145" ON "portals"  ("slug") `,
    );
    await queryRunner.query(
      `ALTER TABLE "publications" ADD CONSTRAINT "FK_4b5bad01d9f4e5a1e15b65024fe" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_a7a84c705f3e8e4fbd497cfb119" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_counters" ADD CONSTRAINT "FK_ab632d5e789ef1131dddddb9c57" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_users" ADD CONSTRAINT "FK_26f83117dea41b00841385b9821" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_users" ADD CONSTRAINT "FK_c4a44a1be146c6c6197f82725d8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" ADD CONSTRAINT "FK_8f75913774150a5d5dde56513b1" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "forms" ADD CONSTRAINT "FK_468fdaa078124f307be065ce24d" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "form_versions" ADD CONSTRAINT "FK_4f22a570ecaca0bee93bbf1a3c7" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "response_comments" ADD CONSTRAINT "FK_d8d1f975fff62ff3f8afe5a793d" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "responses" ADD CONSTRAINT "FK_b58349b3b9ea83108c1bb2dc012" FOREIGN KEY ("formVersionId") REFERENCES "form_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "responses" ADD CONSTRAINT "FK_c85752240270f4947ce28037e19" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "answer_flat" ADD CONSTRAINT "FK_ea89813d86f384a64823727d782" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_lists" ADD CONSTRAINT "FK_c72ebfbd91b47b9a64ced469d10" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contacts" ADD CONSTRAINT "FK_6ab3893f9fa3ed9ef4284c16909" FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_sources" ADD CONSTRAINT "FK_5c1edb0c90e6a1a946a49de7929" FOREIGN KEY ("listId") REFERENCES "contact_lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_logs" ADD CONSTRAINT "FK_3c7334b45331b40a26fd5a3445e" FOREIGN KEY ("publicationId") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "delivery_logs" DROP CONSTRAINT "FK_3c7334b45331b40a26fd5a3445e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_sources" DROP CONSTRAINT "FK_5c1edb0c90e6a1a946a49de7929"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contacts" DROP CONSTRAINT "FK_6ab3893f9fa3ed9ef4284c16909"`,
    );
    await queryRunner.query(
      `ALTER TABLE "contact_lists" DROP CONSTRAINT "FK_c72ebfbd91b47b9a64ced469d10"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answer_flat" DROP CONSTRAINT "FK_ea89813d86f384a64823727d782"`,
    );
    await queryRunner.query(
      `ALTER TABLE "responses" DROP CONSTRAINT "FK_c85752240270f4947ce28037e19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "responses" DROP CONSTRAINT "FK_b58349b3b9ea83108c1bb2dc012"`,
    );
    await queryRunner.query(
      `ALTER TABLE "response_comments" DROP CONSTRAINT "FK_d8d1f975fff62ff3f8afe5a793d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "form_versions" DROP CONSTRAINT "FK_4f22a570ecaca0bee93bbf1a3c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "forms" DROP CONSTRAINT "FK_468fdaa078124f307be065ce24d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workspaces" DROP CONSTRAINT "FK_8f75913774150a5d5dde56513b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_users" DROP CONSTRAINT "FK_c4a44a1be146c6c6197f82725d8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_users" DROP CONSTRAINT "FK_26f83117dea41b00841385b9821"`,
    );
    await queryRunner.query(
      `ALTER TABLE "usage_counters" DROP CONSTRAINT "FK_ab632d5e789ef1131dddddb9c57"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_a7a84c705f3e8e4fbd497cfb119"`,
    );
    await queryRunner.query(
      `ALTER TABLE "publications" DROP CONSTRAINT "FK_4b5bad01d9f4e5a1e15b65024fe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f437df460ca595ccedfb080145"`,
    );
    await queryRunner.query(`DROP TABLE "portals"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ffc6d0c8ce6da8035fa1e51a46"`,
    );
    await queryRunner.query(`DROP TABLE "telegram_link_codes"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1261cbf36f4317a5c16b685d58"`,
    );
    await queryRunner.query(`DROP TABLE "telegram_recipients"`);
    await queryRunner.query(`DROP TABLE "telegram_integrations"`);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "saved_filters"`);
    await queryRunner.query(`DROP TABLE "platform_settings"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0f7c11bc89023854134748a6f4"`,
    );
    await queryRunner.query(`DROP TABLE "queued_jobs"`);
    await queryRunner.query(`DROP TYPE "public"."queued_jobs_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2f2ff95d0b9abe88a66923794b"`,
    );
    await queryRunner.query(`DROP TABLE "otp_challenges"`);
    await queryRunner.query(`DROP TABLE "onprem_licenses"`);
    await queryRunner.query(`DROP TABLE "kiosk_sessions"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TYPE "public"."invoices_status_enum"`);
    await queryRunner.query(`DROP TABLE "interviewer_quotas"`);
    await queryRunner.query(`DROP TABLE "identity_providers"`);
    await queryRunner.query(
      `DROP TYPE "public"."identity_providers_type_enum"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_logs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9236a2cd3f6652b5e6fb93ebf1"`,
    );
    await queryRunner.query(`DROP TABLE "dashboards"`);
    await queryRunner.query(`DROP TABLE "contact_sources"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2d627ce0e4f6664f1775e1321"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0fa3f31879604eee93095dec2b"`,
    );
    await queryRunner.query(`DROP TABLE "contacts"`);
    await queryRunner.query(`DROP TABLE "contact_lists"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
    await queryRunner.query(`DROP TABLE "answer_flat"`);
    await queryRunner.query(`DROP TABLE "responses"`);
    await queryRunner.query(`DROP TYPE "public"."responses_status_enum"`);
    await queryRunner.query(`DROP TABLE "response_comments"`);
    await queryRunner.query(`DROP TABLE "form_versions"`);
    await queryRunner.query(`DROP TABLE "forms"`);
    await queryRunner.query(`DROP TYPE "public"."forms_status_enum"`);
    await queryRunner.query(`DROP TABLE "workspaces"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(`DROP TABLE "organization_users"`);
    await queryRunner.query(
      `DROP TYPE "public"."organization_users_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "usage_counters"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_plancode_enum"`);
    await queryRunner.query(`DROP TABLE "plan_policies"`);
    await queryRunner.query(`DROP TYPE "public"."plan_policies_plancode_enum"`);
    await queryRunner.query(`DROP TABLE "publications"`);
    await queryRunner.query(`DROP TYPE "public"."publications_authmode_enum"`);
    await queryRunner.query(`DROP TYPE "public"."publications_type_enum"`);
  }
}
