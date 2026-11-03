ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_relationship TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS alternate_whatsapp TEXT NOT NULL DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_attendance BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_academics BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_fees BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_notices BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_general BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS whatsapp_configurations(
 id TEXT PRIMARY KEY,institution_id TEXT NOT NULL UNIQUE REFERENCES institutions(id) ON DELETE CASCADE,
 enabled BOOLEAN NOT NULL DEFAULT FALSE,business_account_id TEXT NOT NULL DEFAULT '',phone_number_id TEXT NOT NULL DEFAULT '',display_number TEXT NOT NULL DEFAULT '',
 access_token_ciphertext TEXT NOT NULL DEFAULT '',configuration_status TEXT NOT NULL DEFAULT 'Not Configured',webhook_status TEXT NOT NULL DEFAULT 'Not Configured',
 auto_absence BOOLEAN NOT NULL DEFAULT FALSE,auto_fee_receipt BOOLEAN NOT NULL DEFAULT FALSE,auto_fee_reminder BOOLEAN NOT NULL DEFAULT FALSE,auto_marksheet BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS whatsapp_templates(
 id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,name TEXT NOT NULL,category TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'en',provider_template_name TEXT NOT NULL,enabled BOOLEAN NOT NULL DEFAULT TRUE,
 variables JSONB NOT NULL DEFAULT '[]'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,name)
);
CREATE TABLE IF NOT EXISTS whatsapp_messages(
 id TEXT PRIMARY KEY,institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,student_id TEXT REFERENCES students(id) ON DELETE SET NULL,recipient_name TEXT NOT NULL DEFAULT '',recipient_phone TEXT NOT NULL,
 message_type TEXT NOT NULL,template_name TEXT NOT NULL,language TEXT NOT NULL DEFAULT 'en',parameters JSONB NOT NULL DEFAULT '[]'::jsonb,document_kind TEXT,document_reference TEXT,
 provider_message_id TEXT,idempotency_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Queued',attempt_count INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 error_code TEXT NOT NULL DEFAULT '',error_message TEXT NOT NULL DEFAULT '',sent_by TEXT NOT NULL REFERENCES users(id),sent_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,read_at TIMESTAMPTZ,failed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(institution_id,idempotency_key),UNIQUE(provider_message_id)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue ON whatsapp_messages(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_history ON whatsapp_messages(institution_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_student ON whatsapp_messages(institution_id,student_id,created_at DESC);
