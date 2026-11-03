BEGIN;

-- Multiple FCM device tokens per user with revocation & refresh
CREATE TABLE IF NOT EXISTS fcm_device_tokens (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL DEFAULT 'web',
  user_agent TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','REVOKED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_device_tokens(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_inst ON fcm_device_tokens(institution_id, status);

-- Central Notification Events with Duplicate Prevention (Unique Event Key)
CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  deep_link TEXT NOT NULL DEFAULT '',
  recipient_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK(status IN ('QUEUED','PROCESSED','FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_events_key ON notification_events(event_key);
CREATE INDEX IF NOT EXISTS idx_notif_events_inst ON notification_events(institution_id, event_type);

-- Delivery Attempt Tracking with strict confirmation invariants
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  event_id TEXT REFERENCES notification_events(id) ON DELETE CASCADE,
  notification_id TEXT REFERENCES notifications(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token_id TEXT REFERENCES fcm_device_tokens(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'FCM' CHECK(channel IN ('FCM','IN_APP')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','DELIVERED','FAILED','REVOKED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  provider_message_id TEXT,
  error_code TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_deliv_status ON notification_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_user ON notification_deliveries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_deliv_event ON notification_deliveries(event_id);

-- School-level Notification Event Preferences
CREATE TABLE IF NOT EXISTS school_notification_settings (
  institution_id TEXT PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  student_absent BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_correction BOOLEAN NOT NULL DEFAULT TRUE,
  fee_payment BOOLEAN NOT NULL DEFAULT TRUE,
  fee_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  homework BOOLEAN NOT NULL DEFAULT TRUE,
  exam_results BOOLEAN NOT NULL DEFAULT TRUE,
  announcements BOOLEAN NOT NULL DEFAULT TRUE,
  teacher_leave BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

