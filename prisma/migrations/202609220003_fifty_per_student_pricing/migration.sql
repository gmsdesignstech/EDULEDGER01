-- New purchases and renewals use ₹50 per student per year.
-- Historical subscription and payment rows retain their stored price and amount.
UPDATE subscription_plans
SET price = 50,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'annual-service';
