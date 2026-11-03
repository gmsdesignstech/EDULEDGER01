ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "subscription_start_date" TIMESTAMPTZ;
ALTER TABLE "institutions" ADD COLUMN IF NOT EXISTS "subscription_end_date" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscriptions_school_period
ON subscriptions (institution_id, activation_date, expiry_date);
