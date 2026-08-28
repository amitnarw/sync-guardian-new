-- ============================================================
-- Harden process_phonepe_event: raise on missing subscription
--
-- The original RPC could silently succeed when the subscription
-- row was gone (admin delete, race with cancel-subscription, etc.):
-- the sentinel was inserted, the UPDATE matched 0 rows, and the
-- event was marked processed. PhonePe retries then hit
-- duplicate=true and never re-applied the state change, leaving
-- the user's subscription stuck.
--
-- Now we check ROW_COUNT after the UPDATE and raise if no row
-- matched the (id, user_id) pair. The whole transaction (sentinel
-- + update) rolls back so the next retry can reprocess.
-- ============================================================

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
  v_row_count INT;
BEGIN
  -- Step 1: try to claim the idempotency key.
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
      RETURN jsonb_build_object('duplicate', true, 'processed', true);
    ELSE
      RETURN jsonb_build_object('duplicate', true, 'processed', false);
    END IF;
  END;

  -- Step 2: apply subscription updates.
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

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      -- Roll back the sentinel insert too by raising. PhonePe retry
      -- will re-attempt with fresh state.
      -- Note: the identifier values are intentionally NOT interpolated
      -- into the message so UUIDs do not leak into Postgres logs.
      -- The application-level logger already sanitizes metadata; the
      -- raw RAISE message bypasses that path.
      RAISE EXCEPTION 'subscription row not found or ownership mismatch'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Step 3: mark sentinel processed.
  UPDATE subscription_events
  SET processed_at = now()
  WHERE id = v_event_id;

  RETURN jsonb_build_object('duplicate', false, 'processed', true);
END;
$$;
