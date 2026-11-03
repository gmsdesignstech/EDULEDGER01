-- Additive billing ledger for new WhatsApp Communication add-on purchases.
-- Existing subscriptions, payments, invoices, receipts, and school data are not modified.
CREATE TABLE IF NOT EXISTS whatsapp_addon_subscriptions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_count INTEGER NOT NULL CHECK (student_count > 0),
  price_per_student NUMERIC(12, 2) NOT NULL CHECK (price_per_student > 0),
  amount_paid NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'FAILED', 'CANCELLED')),
  payment_status TEXT NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending', 'Paid', 'Failed', 'Cancelled')),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  activation_date TIMESTAMPTZ NOT NULL,
  expiry_date TIMESTAMPTZ NOT NULL,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT whatsapp_addon_amount_matches_students CHECK ((student_count <= 100 AND amount_paid = 10000) OR (student_count > 100 AND amount_paid = student_count * price_per_student)),
  CONSTRAINT whatsapp_addon_period_valid CHECK (expiry_date > activation_date)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_addon_school
  ON whatsapp_addon_subscriptions(institution_id, status, expiry_date);

-- This table is server-only. Prevent accidental exposure through Supabase's Data API.
ALTER TABLE whatsapp_addon_subscriptions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_addon_subscriptions FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE whatsapp_addon_subscriptions FROM authenticated';
  END IF;
END
$$;
