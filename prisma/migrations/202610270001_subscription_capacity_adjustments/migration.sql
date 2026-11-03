-- Additive ledger for mid-term capacity changes. Existing subscriptions and
-- successful payment history remain untouched.
CREATE TABLE IF NOT EXISTS subscription_adjustments (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  old_capacity INTEGER NOT NULL CHECK (old_capacity > 0),
  new_capacity INTEGER NOT NULL CHECK (new_capacity > 0),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING','PAID','CREDITED','FAILED','CANCELLED')),
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscription_adjustments_school
  ON subscription_adjustments(institution_id,status,created_at);
