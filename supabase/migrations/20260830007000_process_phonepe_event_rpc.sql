-- ============================================================
-- Add processed_at to subscription_events + atomic RPC
--
-- The PhonePe webhook handler previously inserted a sentinel
-- subscription_events row keyed by idempotency_key, then applied
-- subscription updates. If the update failed mid-flight (DB blip,
-- code bug, network), the sentinel remained and future retries
-- were silently ignored — leaving the subscription in the wrong
-- state forever.
--
-- This migration adds a processed_at column and a transactional
-- RPC (process_phonepe_event) so the sentinel insert and the
-- subscription update happen in a single database transaction.
-- If anything fails, the whole thing rolls back and retries can
-- reprocess. Already-processed events return 'duplicate' with
-- processed=true so subsequent retries are short-circuited.
-- ============================================================

ALTER TABLE subscription_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- A partial index on unprocessed events so the compensating-job
-- query can quickly find work that's stuck mid-flight (e.g. the
-- server crashed between INSERT and UPDATE on a previous attempt
-- that did NOT use this RPC). For old webhook rows inserted before
-- this migration, processed_at is NULL — they are treated as
-- unprocessed for diagnostic purposes.
CREATE INDEX IF NOT EXISTS idx_subscription_events_unprocessed
  ON subscription_events (idempotency_key)
  WHERE processed_at IS NULL;

-- -------------------------------------------------------------
-- Atomic event processor
-- -------------------------------------------------------------
--
-- Returns one of:
--   { duplicate: false, processed: true }  - new event, applied
--   { duplicate: true,  processed: true  } - already processed (no-op)
--   { duplicate: true,  processed: false } - another transaction is
--                                            in flight, caller should
--                                            retry shortly
--
-- All subscription column updates are applied atomically with the
-- sentinel insert; either everything commits or nothing does.
CREATE OR REPLACE FUNCTION process_phonepe_event(
  p_idempotency_key TEXT,
  p_subscription_id UUID,
  p_user_id UUID,
  p_event_type TEXT,
  p_payload JSONB,
  p_received_at TIMESTAMPTZ,
  p_subscription_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
  v_existing RECORD;
BEGIN
  -- Step 1: try to claim the idempotency key with an unprocessed
  -- sentinel row. If the unique index rejects it (23505), another
  -- transaction got there first.
  BEGIN
    INSERT INTO subscription_events (
      user_id,
      subscription_id,
      event_type,
      payload,
      idempotency_key,
      received_at,
      processed_at
    )
    VALUES (
      p_user_id,
      p_subscription_id,
      p_event_type,
      p_payload,
      p_idempotency_key,
      p_received_at,
      NULL
    )
    RETURNING id INTO v_event_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT processed_at
      INTO v_existing
    FROM subscription_events
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing.processed_at IS NOT NULL THEN
      RETURN jsonb_build_object(
        'duplicate', true,
        'processed', true
      );
    ELSE
      -- In-flight: another transaction inserted the sentinel but
      -- has not yet committed. Tell the caller to retry.
      RETURN jsonb_build_object(
        'duplicate', true,
        'processed', false
      );
    END IF;
  END;

  -- Step 2: apply subscription updates. We use explicit COALESCE
  -- per known column rather than dynamic SQL so the surface is
  -- constrained and SQL injection from JSONB values is impossible.
  IF p_subscription_updates IS NOT NULL AND p_subscription_updates <> '{}'::jsonb THEN
    UPDATE subscriptions
    SET
      status = COALESCE(p_subscription_updates->>'status', status),
      current_cycle_start = COALESCE(
        (p_subscription_updates->>'current_cycle_start')::timestamptz,
        current_cycle_start
      ),
      current_cycle_end = COALESCE(
        (p_subscription_updates->>'current_cycle_end')::timestamptz,
        current_cycle_end
      ),
      next_charge_at = COALESCE(
        (p_subscription_updates->>'next_charge_at')::timestamptz,
        next_charge_at
      ),
      last_charge_amount_paise = COALESCE(
        (p_subscription_updates->>'last_charge_amount_paise')::bigint,
        last_charge_amount_paise
      )
    WHERE id = p_subscription_id
      AND user_id = p_user_id;
  END IF;

  -- Step 3: mark sentinel processed. Only after the subscription
  -- update has been issued; if Step 2 raises, the transaction
  -- aborts and the sentinel insert is rolled back too.
  UPDATE subscription_events
  SET processed_at = now()
  WHERE id = v_event_id;

  RETURN jsonb_build_object(
    'duplicate', false,
    'processed', true
  );
END;
$$;
