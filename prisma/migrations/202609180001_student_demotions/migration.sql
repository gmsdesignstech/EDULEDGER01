CREATE TABLE IF NOT EXISTS student_demotions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id),
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  previous_class_id TEXT REFERENCES institution_classes(id),
  new_class_id TEXT REFERENCES institution_classes(id),
  previous_section_id TEXT REFERENCES institution_sections(id),
  new_section_id TEXT REFERENCES institution_sections(id),
  previous_academic_year_id TEXT REFERENCES academic_years(id),
  new_academic_year_id TEXT REFERENCES academic_years(id),
  previous_class TEXT NOT NULL,
  new_class TEXT NOT NULL,
  previous_section TEXT NOT NULL,
  new_section TEXT NOT NULL,
  previous_year TEXT NOT NULL,
  new_year TEXT NOT NULL,
  reason TEXT NOT NULL,
  remarks TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  undone_by TEXT REFERENCES users(id),
  undone_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_student_demotions_scope ON student_demotions(institution_id,student_id,created_at);
