-- Future per-student purchases and renewals use ₹100 per student per year.
-- Historical subscription and payment snapshots remain unchanged.
UPDATE subscription_plans
SET price = 100,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'annual-service';
