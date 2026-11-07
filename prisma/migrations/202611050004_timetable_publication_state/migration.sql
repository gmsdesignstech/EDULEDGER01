-- Keep existing timetables visible while adding an explicit publication lifecycle.
ALTER TABLE timetable_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Published';

ALTER TABLE timetable_entries
  DROP CONSTRAINT IF EXISTS timetable_entries_status_check;
ALTER TABLE timetable_entries
  ADD CONSTRAINT timetable_entries_status_check
  CHECK (status IN ('Draft', 'Published', 'Archived'));

-- Archived entries remain available as history, while their slots can be reused.
ALTER TABLE timetable_entries
  DROP CONSTRAINT IF EXISTS timetable_entries_institution_id_class_name_section_academic_year_weekday_start_time_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_active_slot
  ON timetable_entries(institution_id, class_name, section, academic_year, weekday, start_time)
  WHERE status <> 'Archived';

CREATE INDEX IF NOT EXISTS idx_timetable_published_scope
  ON timetable_entries(institution_id, academic_year, class_name, section, weekday, start_time)
  WHERE status = 'Published';
