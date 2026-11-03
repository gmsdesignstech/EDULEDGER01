ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_frequency TEXT NOT NULL DEFAULT 'Custom';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'Fixed';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS discount_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS late_fee NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS net_payable NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS leaving_remarks TEXT NOT NULL DEFAULT '';

-- Existing records retain their financial meaning.
UPDATE payments SET original_amount=amount,net_payable=amount
WHERE original_amount=0 AND net_payable=0;

-- Money columns use exact decimal storage in PostgreSQL.
ALTER TABLE fees ALTER COLUMN total_amount TYPE NUMERIC(12,2) USING ROUND(total_amount::numeric,2);
ALTER TABLE fees ALTER COLUMN discount TYPE NUMERIC(12,2) USING ROUND(discount::numeric,2);
ALTER TABLE fees ALTER COLUMN final_amount TYPE NUMERIC(12,2) USING ROUND(final_amount::numeric,2);
ALTER TABLE fees ALTER COLUMN paid_amount TYPE NUMERIC(12,2) USING ROUND(paid_amount::numeric,2);
ALTER TABLE fees ALTER COLUMN pending_amount TYPE NUMERIC(12,2) USING ROUND(pending_amount::numeric,2);
ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(12,2) USING ROUND(amount::numeric,2);
ALTER TABLE receipts ALTER COLUMN amount TYPE NUMERIC(12,2) USING ROUND(amount::numeric,2);
