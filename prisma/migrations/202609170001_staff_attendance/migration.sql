CREATE TABLE IF NOT EXISTS staff_attendance_settings (
  institution_id TEXT PRIMARY KEY REFERENCES institutions(id),
  work_start_time TEXT NOT NULL DEFAULT '09:00',
  work_end_time TEXT NOT NULL DEFAULT '17:00',
  late_after_time TEXT NOT NULL DEFAULT '09:15',
  break_minutes INTEGER NOT NULL DEFAULT 30,
  working_days TEXT NOT NULL DEFAULT '1,2,3,4,5,6',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  allow_self_checkin BOOLEAN NOT NULL DEFAULT FALSE,
  correction_requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  staff_key TEXT NOT NULL,
  teacher_id TEXT REFERENCES teachers(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present','Absent','Late','Half Day','On Leave','Holiday','Work From Home')),
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_work_minutes INTEGER,
  remarks TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (institution_id, staff_key, attendance_date),
  CHECK ((teacher_id IS NULL) <> (user_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(institution_id, attendance_date, status);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_person ON staff_attendance(institution_id, staff_key, attendance_date);
