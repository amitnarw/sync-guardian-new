-- ============================================================
-- Harden enforce_child_device_limits trigger function
--
-- The original function aborted the triggering transaction if any
-- UPDATE inside it failed (lock timeout, constraint violation, etc.).
-- That would roll back the parent subscriptions / user_trials row
-- change and cause webhooks to retry indefinitely.
--
-- Wrap the enforcement body in an EXCEPTION block so it never
-- aborts the triggering mutation. Failures are surfaced via
-- RAISE NOTICE for observability.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_child_device_limits(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_max_children INT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Resolve paid-subscription entitlement first (highest tier wins).
  SELECT CASE p.tier
    WHEN 'tier_a' THEN 1
    WHEN 'tier_b' THEN 4
    ELSE 0
  END INTO v_max_children
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status IN ('active','revoked','cancelled')
    AND s.current_cycle_end IS NOT NULL
    AND s.current_cycle_end > now()
  ORDER BY s.current_cycle_end DESC NULLS LAST
  LIMIT 1;

  IF v_max_children IS NULL THEN
    -- No entitled subscription; check active trial.
    IF EXISTS (
      SELECT 1 FROM user_trials t
      WHERE t.user_id = p_user_id
        AND t.status = 'active'
        AND t.ends_at > now()
    ) THEN
      v_max_children := 1;
    ELSE
      v_max_children := 0;
    END IF;
  END IF;

  -- Best-effort enforcement. Never abort the parent mutation.
  BEGIN
    IF v_max_children = 0 THEN
      UPDATE pairs
      SET status = 'revoked', revoked_at = now()
      WHERE parent_user_id = p_user_id
        AND status IN ('active','pending');
    ELSE
      UPDATE pairs
      SET status = 'revoked', revoked_at = now()
      WHERE id IN (
        SELECT id FROM pairs
        WHERE parent_user_id = p_user_id
          AND status IN ('active','pending')
        ORDER BY paired_at ASC NULLS LAST
        OFFSET v_max_children
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'enforce_child_device_limits failed for user %: %', p_user_id, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
