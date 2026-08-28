-- ============================================================
-- Add idempotency_key to subscription_events
--
-- The PhonePe webhook can be retried by PhonePe or proxied
-- through intermediaries. To make the webhook handler idempotent
-- we record an idempotency_key for every processed event and
-- short-circuit if the same event has already been processed.
--
-- This migration adds the column and a unique partial index so
-- duplicates are rejected at the database layer.
-- ============================================================

ALTER TABLE subscription_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_idempotency_key
  ON subscription_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
