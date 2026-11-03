-- Preserve historical duplicate ledger rows while excluding them from totals.
WITH ranked AS (
  SELECT id,ROW_NUMBER() OVER (PARTITION BY institution_id,source_type,source_id ORDER BY created_at,id) AS position
  FROM account_transactions
  WHERE source_id IS NOT NULL
)
UPDATE account_transactions a
SET status='Voided',notes=CASE WHEN a.notes='' THEN 'Historical duplicate automatically excluded' ELSE a.notes||' · Historical duplicate automatically excluded' END,updated_at=CURRENT_TIMESTAMP
FROM ranked r
WHERE a.id=r.id AND r.position>1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_source
  ON account_transactions(institution_id,source_type,source_id)
  WHERE source_id IS NOT NULL;

-- Existing schools using the former default gain Saturday without changing
-- schools that have deliberately customized their working days.
UPDATE settings SET timetable_working_days='1,2,3,4,5,6',updated_at=CURRENT_TIMESTAMP
WHERE timetable_working_days='1,2,3,4,5';
