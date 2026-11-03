ALTER TABLE settings ADD COLUMN IF NOT EXISTS school_code TEXT NOT NULL DEFAULT '';

-- Old imports may have duplicate roll numbers. Keep those rows intact and only
-- add the uniqueness guard when existing data permits it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM students WHERE roll_number <> ''
    GROUP BY institution_id, roll_number HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS students_school_roll_unique
      ON students(institution_id, roll_number) WHERE roll_number <> '';
  END IF;
END $$;
