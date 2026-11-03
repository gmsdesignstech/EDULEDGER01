-- Preserve every historical plan, subscription, and payment. Only the current
-- customer-facing offering is changed.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS price_per_student NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE subscription_plans SET active=FALSE WHERE id<>'annual-service';
INSERT INTO subscription_plans(id,name,student_limit,price,billing_period,active,created_at,updated_at)
VALUES('annual-service','Annual Service',2147483647,60,'year',TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,student_limit=EXCLUDED.student_limit,price=EXCLUDED.price,billing_period='year',active=TRUE,updated_at=CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_subscriptions_pricing_snapshot ON subscriptions(institution_id,student_capacity,price_per_student,amount_paid);
UPDATE subscription_payments SET status='SUCCESS' WHERE status='ACTIVE';
