-- Forward-only WhatsApp hardening. Existing school, billing, attendance, fee,
-- payment, result, and message rows are preserved.
BEGIN;

ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_consent_status TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_consent_source TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_opted_out_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_contact_verified_at TIMESTAMPTZ;

ALTER TABLE whatsapp_configurations ADD COLUMN IF NOT EXISTS test_mode BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE whatsapp_configurations ADD COLUMN IF NOT EXISTS default_country_code TEXT NOT NULL DEFAULT '91';
ALTER TABLE whatsapp_configurations ADD COLUMN IF NOT EXISTS webhook_last_received_at TIMESTAMPTZ;

ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS provider_category TEXT NOT NULL DEFAULT '';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ;
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS lease_owner TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS provider_status_at TIMESTAMPTZ;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS outcome_class TEXT NOT NULL DEFAULT '';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS last_worker_id TEXT NOT NULL DEFAULT '';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS audience JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS request_payload_hash TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id TEXT PRIMARY KEY,
  provider_event_key TEXT NOT NULL UNIQUE,
  provider_message_id TEXT NOT NULL,
  event_status TEXT NOT NULL,
  event_at TIMESTAMPTZ,
  payload_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_consent_events (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  contact_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('GRANTED','OPTED_OUT','UNKNOWN')),
  source TEXT NOT NULL,
  changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  audience_fingerprint TEXT NOT NULL,
  criteria JSONB NOT NULL,
  message_type TEXT NOT NULL,
  template_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING','QUEUED','CANCELLED','FAILED')),
  eligible_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
  queued_count INTEGER NOT NULL DEFAULT 0 CHECK (queued_count >= 0),
  excluded_count INTEGER NOT NULL DEFAULT 0 CHECK (excluded_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  UNIQUE(institution_id, idempotency_key),
  CHECK (queued_count <= eligible_count)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_messages_campaign_fk') THEN
    ALTER TABLE whatsapp_messages ADD CONSTRAINT whatsapp_messages_campaign_fk
      FOREIGN KEY (campaign_id) REFERENCES whatsapp_campaigns(id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_campaign_student
  ON whatsapp_messages(campaign_id, student_id) WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_queue
  ON whatsapp_messages(status, scheduled_at, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_claimed
  ON whatsapp_messages(status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_message
  ON whatsapp_webhook_events(provider_message_id, event_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_consent_student
  ON whatsapp_consent_events(institution_id, student_id, occurred_at DESC);

ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_webhook_events FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_webhook_events FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_consent_events FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_consent_events FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_campaigns FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_campaigns FROM authenticated';
  END IF;
END
$$;

COMMIT;
