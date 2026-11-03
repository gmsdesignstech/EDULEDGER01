-- Safe, forward-only attendance system upgrade.
-- Preserves existing attendance rows and does not duplicate database tables.
BEGIN;

-- Upgrade attendance status constraint to support Present, Absent, Late, Excused, Half-day, and legacy Leave
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK(status IN ('Present','Absent','Late','Leave','Excused','Half-day','Half Day'));

-- Add attendance correction window configuration to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS attendance_correction_window_hours INTEGER NOT NULL DEFAULT 24;

-- Create attendance audit history table
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  attendance_id TEXT,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  class_name TEXT NOT NULL,
  section TEXT NOT NULL,
  date TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_remarks TEXT NOT NULL DEFAULT '',
  new_remarks TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_scope ON attendance_audit_logs(institution_id,class_name,section,date);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_student ON attendance_audit_logs(student_id,date);

-- Create school holidays table for holiday-aware calculations
CREATE TABLE IF NOT EXISTS school_holidays (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  academic_year TEXT NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Public Holiday' CHECK(type IN ('Public Holiday','School Holiday','Vacation','Weather Emergency','Administrative')),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(institution_id,date)
);

CREATE INDEX IF NOT EXISTS idx_school_holidays_scope ON school_holidays(institution_id,academic_year,date);

COMMIT;

