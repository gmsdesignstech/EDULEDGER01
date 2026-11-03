ALTER TABLE payments ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_request_id
  ON payments(institution_id, request_id)
  WHERE request_id IS NOT NULL;

-- Only blank legacy identifiers are filled. Existing numbers, dates and amounts stay unchanged.
UPDATE fees SET invoice_number='INV-LEGACY-'||id WHERE TRIM(invoice_number)='';
UPDATE payments SET receipt_number='REC-LEGACY-'||id WHERE TRIM(receipt_number)='';
UPDATE receipts r SET invoice_number=f.invoice_number
  FROM payments p JOIN fees f ON f.id=p.fee_id
  WHERE r.payment_id=p.id AND TRIM(r.invoice_number)='';
UPDATE receipts r SET receipt_number=p.receipt_number
  FROM payments p WHERE r.payment_id=p.id AND TRIM(r.receipt_number)='';
