-- ============================================================
-- Reconcile claim_pairing_token with the edge-function caller
--
-- The hardening migration `20260831030000_...` overwrote
-- claim_pairing_token with a 2-argument signature
-- (p_token, p_parent_user_id) that does not match what the
-- claim-pairing-token edge function actually calls:
--
--   adminClient.rpc('claim_pairing_token', {
--     p_token: token,
--     p_code: code,
--     p_parent_user_id: user.id,
--   })
--
-- Deploying that migration as-is breaks all new pairings because
-- p_code is dropped on the floor by Postgres' strict signature
-- check. This migration restores the 3-argument signature, the
-- JSONB return shape, the parent device reuse behavior, and the
-- tier-limit enforcement.
--
-- Production behavior preserved from `20260830000000_...`:
--   * Free tier: 0 child devices, revokes existing pairs.
--   * Active trial: 1 child device.
--   * Paid subscription: tier_a=1, tier_b=4.
--   * On downgrade, revokes excess pairs (keep oldest).
--
-- New behavior added:
--   * Reuse an existing parent device row instead of generating
--     a fresh UUID, so re-pairing after a revoke does not collide
--     with the unique_user_role constraint on devices(user_id, role).
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_pairing_token(
  p_token TEXT,
  p_code TEXT,
  p_parent_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Lock the pairing_tokens row to prevent races on the token itself.
  -- Either p_token or p_code identifies the token; the edge function
  -- passes both for QR-JWT path convenience.
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
    RAISE EXCEPTION 'Invalid or expired pairing code';
  END IF;

  -- Transaction-scoped advisory lock so two concurrent claims for the
  -- same parent cannot both pass the tier-limit check.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('claim_limit:' || p_parent_user_id::text, 0)
  );

  PERFORM 1
  FROM pairs
  WHERE parent_user_id = p_parent_user_id
    AND status IN ('active', 'pending')
  FOR UPDATE;

  -- Subscription / trial entitlement (same grace-period rule as the
  -- shared entitlement module):
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
  INTO v_has_paid_subscription, v_has_active_trial;

  SELECT COUNT(*)::INT INTO v_current_children
  FROM pairs
  WHERE parent_user_id = p_parent_user_id
    AND status IN ('active', 'pending');

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
      v_max_children := 0;
    END IF;
  ELSIF v_has_active_trial THEN
    v_max_children := 1;
  ELSE
    v_max_children := 0;
  END IF;

  -- Free tier revokes; downgrades preserve oldest first.
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

  -- Reuse an existing parent device row for this user (or create one)
  -- so re-pairing after a revoke does not collide with the
  -- unique_user_role constraint.
  SELECT id INTO v_parent_device_id
  FROM devices
  WHERE user_id = p_parent_user_id
    AND role = 'parent'
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_parent_device_id IS NULL THEN
    v_parent_device_id := gen_random_uuid();
    INSERT INTO devices (
      id, user_id, role, platform, last_seen_at, is_foreground
    )
    VALUES (
      v_parent_device_id, p_parent_user_id, 'parent', 'android', now(), true
    );
  ELSE
    UPDATE devices
    SET last_seen_at = now()
    WHERE id = v_parent_device_id;
  END IF;

  -- Soft-revoke any active pair for the same child device so tier-limit
  -- triggers don't double-count history across re-pairings.
  UPDATE pairs
  SET status = 'revoked', revoked_at = now()
  WHERE child_device_id = v_token_data.child_device_id
    AND status = 'active';

  -- Resolve child_user_id from the child device row.
  SELECT user_id INTO v_child_user_id
  FROM devices WHERE id = v_token_data.child_device_id;

  IF v_child_user_id IS NULL THEN
    RAISE EXCEPTION 'Child device not found';
  END IF;

  INSERT INTO pairs (
    parent_device_id, child_device_id, parent_user_id, child_user_id, status, paired_at
  )
  VALUES (
    v_parent_device_id, v_token_data.child_device_id,
    p_parent_user_id, v_child_user_id, 'active', now()
  )
  RETURNING id INTO v_pair_id;

  UPDATE pairing_tokens
  SET consumed_at = now(), pair_id = v_pair_id
  WHERE id = v_token_data.id;

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
$$;
