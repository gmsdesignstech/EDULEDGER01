-- Add a versioned, opt-in fixed annual plan without modifying historical
-- subscriptions, payments, prices, or renewal dates.
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT',
  ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS effective_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eligible_new_schools BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS student_count_at_purchase INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT',
  ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1;

UPDATE subscriptions
SET student_count_at_purchase = student_capacity
WHERE student_count_at_purchase IS NULL;

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS student_count_at_purchase INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_model TEXT NOT NULL DEFAULT 'PER_STUDENT',
  ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1;

UPDATE subscription_payments
SET student_count_at_purchase = student_capacity
WHERE student_count_at_purchase IS NULL;

INSERT INTO subscription_plans(
  id,name,student_limit,price,billing_period,active,
  pricing_model,plan_version,effective_at,eligible_new_schools,
  created_at,updated_at
)
VALUES(
  'starter-annual-v1','EduLedger Starter',99,10000,'year',TRUE,
  'FIXED',1,'2026-10-24T00:00:00+05:30',TRUE,
  CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO UPDATE SET
  name=EXCLUDED.name,
  student_limit=EXCLUDED.student_limit,
  price=EXCLUDED.price,
  billing_period=EXCLUDED.billing_period,
  active=EXCLUDED.active,
  pricing_model=EXCLUDED.pricing_model,
  plan_version=EXCLUDED.plan_version,
  effective_at=EXCLUDED.effective_at,
  eligible_new_schools=EXCLUDED.eligible_new_schools,
  updated_at=CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_subscriptions_purchase_snapshot
ON subscriptions(institution_id,plan_id,student_count_at_purchase,amount_paid);
