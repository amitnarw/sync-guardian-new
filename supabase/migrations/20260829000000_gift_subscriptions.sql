-- ============================================================
-- Admin gift/extend subscriptions and trials.
--
-- Adds bookkeeping columns to `subscriptions` so we can distinguish
-- PhonePe-billed rows from admin-granted complimentary rows, and
-- audit who granted them. Trial gifting reuses the existing
-- `user_trials` table via UPSERT (no schema change needed).
--
-- Behavior:
--   - new rows default to source='phonepe'
--   - gifted rows have source='gift', null merchant_subscription_id
--   - the existing UNIQUE INDEX on merchant_subscription_id is a
--     partial index on (merchant_subscription_id) WHERE NOT NULL,
--     so null merchant ids don't conflict.
--   - the existing unique active-subscription-per-user partial
--     index allows multiple terminal/cancelled rows per user, so
--     re-gifting after revoke works.
-- ============================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'phonepe'
    CHECK (source IN ('phonepe', 'gift')),
  ADD COLUMN IF NOT EXISTS gifted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gifted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_source ON subscriptions (source);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gifted_by ON subscriptions (gifted_by);