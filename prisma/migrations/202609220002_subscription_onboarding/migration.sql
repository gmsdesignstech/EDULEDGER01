ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS planned_student_count INTEGER NOT NULL DEFAULT 0;

UPDATE institutions AS i
SET planned_student_count = GREATEST(
  COALESCE((
    SELECT s.student_capacity
    FROM subscriptions AS s
    WHERE s.institution_id = i.id
      AND s.status IN ('ACTIVE', 'EXPIRING_SOON')
    ORDER BY s.created_at DESC
    LIMIT 1
  ), 0),
  COALESCE((
    SELECT COUNT(*)
    FROM students AS st
    WHERE st.institution_id = i.id AND st.status = 'Active'
  ), 0)
)
WHERE i.planned_student_count = 0;
