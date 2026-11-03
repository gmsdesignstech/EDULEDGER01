-- Backfill/repair is performed by the transactional administrator action,
-- because each tenant's validated school code is required. This migration
-- installs the uniqueness guard whenever legacy data is already conflict-free.
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
