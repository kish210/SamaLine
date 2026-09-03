ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'qr';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'embed';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'popup';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'sms';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'kiosk';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'app';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'portal';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'interviewer';
ALTER TYPE publication_type ADD VALUE IF NOT EXISTS 'social';

DO $$ BEGIN
  CREATE TYPE publication_auth_mode AS ENUM ('none','param','link','password','otp','oauth','ldap');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE publications
  ADD COLUMN IF NOT EXISTS auth_mode publication_auth_mode NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(240),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quota INTEGER,
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TYPE plan_code AS ENUM ('free','pro','org','enterprise');

CREATE TABLE IF NOT EXISTS plan_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code plan_code NOT NULL UNIQUE,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code plan_code NOT NULL DEFAULT 'free',
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_key VARCHAR(20) NOT NULL,
  metric VARCHAR(60) NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  limit_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, period_key, metric)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event VARCHAR(120) NOT NULL,
  target_url VARCHAR(500) NOT NULL,
  secret VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action VARCHAR(120) NOT NULL,
  actor_type VARCHAR(120) NOT NULL,
  actor_id VARCHAR(120),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plan_policies (plan_code, limits)
VALUES
  ('free', '{"activeForms":1,"responsesPerMonth":200,"maxQuestionTypes":10,"logicDisplay":false,"logicSkip":false,"indices":0}'::jsonb),
  ('pro', '{"activeForms":5,"responsesPerMonth":1000,"maxQuestionTypes":12,"logicDisplay":true,"logicSkip":false,"indices":0}'::jsonb),
  ('org', '{"activeForms":10,"responsesPerMonth":-1,"maxQuestionTypes":16,"logicDisplay":true,"logicSkip":true,"indices":1}'::jsonb),
  ('enterprise', '{"activeForms":-1,"responsesPerMonth":-1,"maxQuestionTypes":24,"logicDisplay":true,"logicSkip":true,"indices":5}'::jsonb)
ON CONFLICT (plan_code) DO NOTHING;
