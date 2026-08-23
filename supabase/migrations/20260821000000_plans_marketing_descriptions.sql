-- ============================================================
-- Plans marketing descriptions.
--
-- Replaces the generic 'Monthly monitoring plan' / 'Yearly monitoring plan'
-- seed descriptions with the marketing copy the mobile checkout renders
-- (Plan.description comes from here).
-- Idempotent: only rewrites rows that still match the generic seed.
-- ============================================================

UPDATE plans SET description = 'Real-time notification mirror'
  WHERE tier = 'tier_a' AND description = 'Monthly monitoring plan';

UPDATE plans SET description = 'Real-time notification mirror, UPI AutoPay'
  WHERE tier = 'tier_a' AND description = 'Yearly monitoring plan';

UPDATE plans SET description = 'Priority monitoring for households'
  WHERE tier = 'tier_b' AND description = 'Monthly monitoring plan';

UPDATE plans SET description = 'Priority monitoring for households with 4-device limit'
  WHERE tier = 'tier_b' AND description = 'Yearly monitoring plan';
