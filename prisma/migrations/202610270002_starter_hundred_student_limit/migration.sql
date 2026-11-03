-- Align the persisted plan catalogue with the published 1-100 student
-- Starter boundary. Historical subscriptions and payment snapshots are not
-- modified; only future plan selection reads this catalogue value.
UPDATE subscription_plans
SET student_limit = 100,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'starter-annual-v1'
  AND student_limit <> 100;
