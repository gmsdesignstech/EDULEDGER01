CREATE TABLE IF NOT EXISTS salary_payment_events(
 id TEXT PRIMARY KEY,
 institution_id TEXT NOT NULL REFERENCES institutions(id),
 salary_id TEXT NOT NULL REFERENCES salaries(id) ON DELETE RESTRICT,
 request_id TEXT NOT NULL,
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0),
 account_transaction_id TEXT NOT NULL REFERENCES account_transactions(id) ON DELETE RESTRICT,
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(institution_id,request_id)
);
CREATE INDEX IF NOT EXISTS idx_salary_payment_events_salary ON salary_payment_events(institution_id,salary_id,created_at);
UPDATE account_transactions SET category='Staff Salaries',description=CASE WHEN description LIKE 'Salary payment - %' THEN description ELSE 'Salary payment - '||description END,updated_at=CURRENT_TIMESTAMP WHERE source_type='salary_payment' AND category='Salary/Payroll';

INSERT INTO account_transactions(id,institution_id,academic_year,transaction_type,category,amount_paise,transaction_date,description,payment_method,reference_number,source_type,source_id,status,notes,created_by)
SELECT gen_random_uuid()::text,s.institution_id,
 CASE WHEN EXTRACT(MONTH FROM COALESCE(NULLIF(s.payment_date,'')::date,MAKE_DATE(s.salary_year,4,1)))<4 THEN (EXTRACT(YEAR FROM COALESCE(NULLIF(s.payment_date,'')::date,MAKE_DATE(s.salary_year,4,1)))-1)::int||'-'||EXTRACT(YEAR FROM COALESCE(NULLIF(s.payment_date,'')::date,MAKE_DATE(s.salary_year,4,1)))::int ELSE EXTRACT(YEAR FROM COALESCE(NULLIF(s.payment_date,'')::date,MAKE_DATE(s.salary_year,4,1)))::int||'-'||(EXTRACT(YEAR FROM COALESCE(NULLIF(s.payment_date,'')::date,MAKE_DATE(s.salary_year,4,1)))+1)::int END,
 'expense','Staff Salaries',s.paid_paise,COALESCE(NULLIF(s.payment_date,''),MAKE_DATE(s.salary_year,4,1)::text),'Salary payment - '||s.employee_name,COALESCE(NULLIF(s.payment_method,''),'Other'),COALESCE(NULLIF(s.payment_reference,''),'SAL-'||s.salary_year||'-'||UPPER(SUBSTRING(s.id,1,8))),'salary_payment',s.id,'Active','Reconciled from salary payment',s.created_by
FROM salaries s
WHERE s.paid_paise>0 AND s.payment_status IN ('Paid','Partially Paid')
ON CONFLICT(institution_id,source_type,source_id) WHERE source_id IS NOT NULL DO UPDATE SET category='Staff Salaries',amount_paise=EXCLUDED.amount_paise,transaction_date=EXCLUDED.transaction_date,description=EXCLUDED.description,payment_method=EXCLUDED.payment_method,reference_number=EXCLUDED.reference_number,status='Active',updated_at=CURRENT_TIMESTAMP;
