CREATE TABLE IF NOT EXISTS result_examinations (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  name TEXT NOT NULL,
  academic_year TEXT NOT NULL,
  class_name TEXT NOT NULL,
  section TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  publication_date TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Marks Entry Open','Marks Entry Closed','Results Under Review','Approved','Published','Archived')),
  created_by TEXT REFERENCES users(id),
  verified_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  published_by TEXT REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (institution_id,academic_year,class_name,section,name)
);
CREATE INDEX IF NOT EXISTS idx_result_examinations_scope ON result_examinations(institution_id,academic_year,class_name,section,status);
CREATE INDEX IF NOT EXISTS idx_result_examinations_publish ON result_examinations(institution_id,status,published_at);
CREATE TABLE IF NOT EXISTS result_publication_snapshots (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  examination_id TEXT NOT NULL REFERENCES result_examinations(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  published_by TEXT NOT NULL REFERENCES users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (examination_id,version)
);
CREATE INDEX IF NOT EXISTS idx_result_snapshots_scope ON result_publication_snapshots(institution_id,examination_id,version);

ALTER TABLE class_exams ADD COLUMN IF NOT EXISTS result_examination_id TEXT REFERENCES result_examinations(id);
ALTER TABLE class_exams ADD COLUMN IF NOT EXISTS max_marks_cent INTEGER;
ALTER TABLE class_exams ADD COLUMN IF NOT EXISTS passing_marks_cent INTEGER;
ALTER TABLE class_exams ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_class_exam_group_subject ON class_exams(result_examination_id,subject) WHERE result_examination_id IS NOT NULL;

ALTER TABLE class_results ADD COLUMN IF NOT EXISTS marks_cent INTEGER;
ALTER TABLE class_results ADD COLUMN IF NOT EXISTS mark_status TEXT NOT NULL DEFAULT 'Scored';
ALTER TABLE class_results ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';
ALTER TABLE class_results ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id);
ALTER TABLE class_results ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_class_results_exam ON class_results(institution_id,exam_id,student_id);

ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_grade_bands TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_overall_pass_percent INTEGER NOT NULL DEFAULT 35;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_require_subject_pass BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_ranking_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_principal_remarks TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_class_teacher_remarks TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS result_report_format TEXT NOT NULL DEFAULT 'Standard';
