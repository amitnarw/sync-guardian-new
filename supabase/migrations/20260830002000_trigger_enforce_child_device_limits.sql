-- ============================================================
-- Trigger-based child-device limit enforcement
--
-- Previously, `claim_pairing_token` did the revoke-and-raise
-- cleanup inline, but because the function runs inside a single
-- transaction, raising `PARENT_CHILD_LIMIT_REACHED` rolled back
-- the revocations. Existing child devices were never realistically
-- removed when a parent's entitlement lapsed or downgraded.
--
-- This migration adds an idempotent `enforce_child_device_limits`
-- function that runs whenever a `subscriptions` or `user_trials`
-- row changes (INSERT OR UPDATE). It commits independently of the
-- edge function that triggered the change, so cleanup always
-- persists. The function mirrors the entitlement rules used by the
-- shared Deno module and the SQL `claim_pairing_token` function:
--
--   - Entitled subscription (status IN ('active','revoked','cancelled')
--     AND current_cycle_end > now()): use plan tier
--     (tier_a = 1, tier_b = 4, unknown = 0).
--   - Active trial: 1 child.
--   - Otherwise: 0 children (free tier).
--
-- Oldest children are preserved; excess ones are revoked in
-- paired_at order (NULLS LAST).
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

  IF v_max_children = 0 THEN
    -- Free tier: revoke all active/pending pairs.
    UPDATE pairs
    SET status = 'revoked', revoked_at = now()
    WHERE parent_user_id = p_user_id
      AND status IN ('active','pending');
  ELSE
    -- Cap active/pending pairs to the allowed limit; keep oldest.
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION trg_enforce_limits_on_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM enforce_child_device_limits(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_limits_after_sub_change ON subscriptions;
CREATE TRIGGER enforce_limits_after_sub_change
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trg_enforce_limits_on_subscriptions();

CREATE OR REPLACE FUNCTION trg_enforce_limits_on_trials()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM enforce_child_device_limits(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_limits_after_trial_change ON user_trials;
CREATE TRIGGER enforce_limits_after_trial_change
  AFTER INSERT OR UPDATE ON user_trials
  FOR EACH ROW
  EXECUTE FUNCTION trg_enforce_limits_on_trials();
