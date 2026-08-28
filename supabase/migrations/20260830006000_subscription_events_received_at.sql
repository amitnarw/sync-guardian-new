-- ============================================================
-- Add received_at to subscription_events
--
-- The PhonePe webhook handler now uses an INSERT-first idempotency
-- pattern: it attempts to insert a sentinel row keyed by
-- idempotency_key, and on success computes the billing-cycle update.
-- We want the sentinel row to record when PhonePe delivered the
-- event (not when our server received it) so retries are auditable
-- in event order. This column is populated from PhonePe's payload
-- timestamp when available, falling back to server time.
-- ============================================================

ALTER TABLE subscription_events
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Index on (subscription_id, received_at DESC) for downstream audit
-- queries that need to replay events for a subscription in delivery
-- order. Subscriptions with very few events will not benefit, but the
-- index is small and avoids a sort on the audit path.
CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription_received_at
  ON subscription_events (subscription_id, received_at DESC NULLS LAST)
  WHERE subscription_id IS NOT NULL;
