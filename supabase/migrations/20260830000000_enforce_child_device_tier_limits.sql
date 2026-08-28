-- ============================================================
-- Enforce child-device tier limits in claim_pairing_token
--
-- Product rules (locked) — must mirror
-- `supabase/functions/_shared/subscription-entitlement.ts`:
--   - Free tier (no active trial and no entitled subscription):
--       0 child devices allowed. No pairs can be created.
--   - Active trial (7 days after registration, or admin-gifted
--     trial days via user_trials with status='active' and
--     ends_at > now()): 1 child device allowed.
--   - Paid subscription (subscriptions.status IN ('active','revoked',
--     'cancelled') AND current_cycle_end IS NOT NULL AND current_cycle_end
--     > now()): use the plan's child-device limit (tier_a = 1, tier_b = 4).
--     Cancellation does not cut access off instantly; it takes effect only
--     when the current paid period ends. PhonePe pause events are mapped to
--     'revoked' upstream so they fall into the grace-period rule above.
--
-- Invariant: a parent has at most one subscription at any time. The
-- single-entitled-row query picks the row with the furthest
-- current_cycle_end; if multiple rows ever appear (data-integrity bug)
-- the SQL still works deterministically.
--
-- On limit reduction (subscription downgrade or entitlement
-- expiry), excess active/pending pairs are revoked. The
-- first/oldest paired child device is preserved (never touched).
-- Subsequent ones are revoked in paired_at order (NULLS LAST)
-- until the count matches the new limit.
--
-- Failure mode:
--   RAISE EXCEPTION 'PARENT_CHILD_LIMIT_REACHED' which the edge
--   function maps to HTTP 402 with a customer-friendly message.
-- ============================================================

CREATE OR REPLACE FUNCTION claim_pairing_token(
  p_token TEXT,
  p_code TEXT,
  p_parent_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_token_data RECORD;
  v_parent_device_id UUID;
  v_child_user_id UUID;
  v_pair_id UUID;
  v_result JSONB;
  v_max_children INT;
  v_current_children INT;
  v_has_active_trial BOOLEAN;
  v_has_paid_subscription BOOLEAN;
BEGIN
  -- Lock the pairing_tokens row to prevent race condition on the token itself.
  IF p_token IS NOT NULL THEN
    SELECT INTO v_token_data *
    FROM pairing_tokens
    WHERE token = p_token
      AND consumed_at IS NULL
      AND expires_at > now()
    FOR UPDATE;
  ELSE
    SELECT INTO v_token_data *
    FROM pairing_tokens
    WHERE code = p_code
      AND consumed_at IS NULL
      AND expires_at > now()
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Acquire a transaction-scoped advisory lock so two concurrent claim
  -- calls for the same parent are serialized. Without this, both calls
  -- can read the same pair count and both insert, exceeding the tier limit.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('claim_limit:' || p_parent_user_id::text, 0)
  );

  -- Serialize the parent's pair state so two concurrent claims cannot
  -- both pass the child-device limit check. We do this by locking all
  -- existing rows for this parent and recounting after the lock.
  PERFORM 1
  FROM pairs
  WHERE parent_user_id = p_parent_user_id
    AND status IN ('active', 'pending')
  FOR UPDATE;

  -- Resolve whether the parent has an entitled subscription or an active
  -- trial. Subscription entitlement uses the same grace-period rule as
  -- the shared entitlement module:
  --   status IN ('active','revoked','cancelled')
  --   AND current_cycle_end IS NOT NULL
  --   AND current_cycle_end > now()
  SELECT
    EXISTS (
      SELECT 1
      FROM subscriptions s
      WHERE s.user_id = p_parent_user_id
        AND s.status IN ('active','revoked','cancelled')
        AND s.current_cycle_end IS NOT NULL
        AND s.current_cycle_end > now()
    ),
    EXISTS (
      SELECT 1
      FROM user_trials t
      WHERE t.user_id = p_parent_user_id
        AND t.status = 'active'
        AND t.ends_at > now()
    )
  INTO v_has_paid_subscription, v_has_active_trial
  ;

  -- Count the caller's existing non-revoked pairs.
  SELECT COUNT(*)::INT
  INTO v_current_children
  FROM pairs
  WHERE parent_user_id = p_parent_user_id
    AND status IN ('active', 'pending');

  -- Tier resolution (matches product rules in the header AND the shared
  -- entitlement module):
  --   * Entitled subscription: use the single entitled subscription's
  --     plan tier. Unknown tiers map to 0 instead of silently granting
  --     the highest tier. If multiple entitled rows exist (invariant
  --     violation), the one with the furthest current_cycle_end wins.
  --   * Active trial: free-tier cap of 1 child.
  --   * Otherwise (no trial, no entitled subscription): 0 children.
  IF v_has_paid_subscription THEN
    SELECT CASE p.tier
      WHEN 'tier_a' THEN 1
      WHEN 'tier_b' THEN 4
      ELSE 0
    END
    INTO v_max_children
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = p_parent_user_id
      AND s.status IN ('active','revoked','cancelled')
      AND s.current_cycle_end IS NOT NULL
      AND s.current_cycle_end > now()
    ORDER BY s.current_cycle_end DESC NULLS LAST
    LIMIT 1;

    IF v_max_children IS NULL THEN
      -- Subscription row exists but the plan row is missing. Conservative
      -- fallback: treat as free tier.
      v_max_children := 0;
    END IF;
  ELSIF v_has_active_trial THEN
    v_max_children := 1;
  ELSE
    v_max_children := 0;
  END IF;

  -- Free tier: explicitly revoke any existing pairs so a parent who
  -- lapses into free tier has their devices removed. Tier downgrade /
  -- period expiry: revoke excess pairs, keeping the first/oldest.
  IF v_max_children = 0 AND v_current_children > 0 THEN
    UPDATE pairs
    SET status = 'revoked', revoked_at = now()
    WHERE parent_user_id = p_parent_user_id
      AND status IN ('active', 'pending');
    v_current_children := 0;
  ELSIF v_max_children > 0 AND v_current_children > v_max_children THEN
    UPDATE pairs
    SET status = 'revoked', revoked_at = now()
    WHERE id IN (
      SELECT id FROM pairs
      WHERE parent_user_id = p_parent_user_id
        AND status IN ('active', 'pending')
      ORDER BY paired_at ASC NULLS LAST
      OFFSET v_max_children
    );
    v_current_children := v_max_children;
  END IF;

  IF v_current_children >= v_max_children THEN
    RAISE EXCEPTION 'PARENT_CHILD_LIMIT_REACHED'
      USING ERRCODE = 'P0001';
  END IF;

  -- Generate parent device ID
  v_parent_device_id := gen_random_uuid();

  -- Insert parent device (atomic with pair)
  INSERT INTO devices (
    id, user_id, role, platform
  )
  VALUES (
    v_parent_device_id, p_parent_user_id, 'parent', 'android'
  );

  -- Get child user_id
  SELECT user_id INTO v_child_user_id
  FROM devices WHERE id = v_token_data.child_device_id;

  IF v_child_user_id IS NULL THEN
    RAISE EXCEPTION 'Child device not found';
  END IF;

  -- Insert pair
  INSERT INTO pairs (
    parent_device_id, child_device_id, parent_user_id, child_user_id, status, paired_at
  )
  VALUES (
    v_parent_device_id, v_token_data.child_device_id,
    p_parent_user_id, v_child_user_id, 'active', now()
  )
  RETURNING id INTO v_pair_id;

  -- Mark token as consumed
  UPDATE pairing_tokens
  SET consumed_at = now(), pair_id = v_pair_id
  WHERE id = v_token_data.id;

  -- Return pair data
  SELECT jsonb_build_object(
    'id', p.id,
    'parent_device_id', p.parent_device_id,
    'child_device_id', p.child_device_id,
    'parent_user_id', p.parent_user_id,
    'child_user_id', p.child_user_id,
    'status', p.status,
    'paired_at', p.paired_at,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  INTO v_result
  FROM pairs p WHERE p.id = v_pair_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
