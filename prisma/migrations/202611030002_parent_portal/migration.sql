BEGIN;

-- Table linking parents to multiple children
CREATE TABLE IF NOT EXISTS parent_students (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL DEFAULT 'Parent',
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(parent_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_students_user ON parent_students(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);

-- Table for parent invitation codes and account activations
CREATE TABLE IF NOT EXISTS parent_invitations (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL DEFAULT '',
  invitation_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACCEPTED','EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_parent_invitations_code ON parent_invitations(invitation_code, status);
CREATE INDEX IF NOT EXISTS idx_parent_invitations_student ON parent_invitations(institution_id, student_id);

COMMIT;

