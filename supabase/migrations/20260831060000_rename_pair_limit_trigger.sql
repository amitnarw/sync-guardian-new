-- ============================================================
-- Rename the per-pair child-device-limit trigger function and
-- reconcile its default tier limit.
--
-- Background:
--   Migration 20260831030000_harden_relationship_key_schema.sql
--   created `enforce_child_device_limits() RETURNS TRIGGER` on
--   the `pairs` table. That name is overloaded with the scalar
--   function `enforce_child_device_limits(p_user_id UUID)
--   RETURNS VOID` defined in
--   20260830004000_harden_enforce_child_device_limits.sql and
--   invoked by triggers on `subscriptions` and `user_trials`.
--
--   Two overloaded functions with the same name but very
--   different semantics is confusing and error-prone; future
--   migrations could accidentally `CREATE OR REPLACE FUNCTION
--   enforce_child_device_limits(...)` and clobber the wrong
--   overload. This migration renames the pairs trigger to
--   `enforce_child_device_limits_on_pairs()` to remove the
--   ambiguity.
--
--   The trigger also had a default tier limit of `3` when no
--   subscription row is found, while the scalar function
--   defaults to `0` (free tier). Per the product rules in
--   AGENTS.md:
--     * Free tier (no active trial, no entitled subscription):
--         0 child devices allowed.
--   So the trigger default is corrected to `0`.
-- ============================================================

DROP TRIGGER IF EXISTS enforce_child_device_limits ON pairs;

DROP FUNCTION IF EXISTS enforce_child_device_limits();

CREATE OR REPLACE FUNCTION public.enforce_child_device_limits_on_pairs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_count int;
  v_tier_limit int;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  -- Count existing active pairs for this child device, excluding
  -- the row we are about to insert/update so a single insert does
  -- not count itself.
  SELECT count(*) INTO v_existing_count
  FROM pairs
  WHERE child_device_id = NEW.child_device_id
    AND status = 'active'
    AND id <> NEW.id;

  -- Look up the parent's tier limit via their active subscription
  -- or trial. Default to 0 (free tier) to match the scalar
  -- enforce_child_device_limits function and the product rule
  -- "no trial + no subscription => 0 child devices".
  SELECT COALESCE(MAX(s.tier_child_device_limit), 0) INTO v_tier_limit
  FROM subscriptions s
  WHERE s.user_id = NEW.parent_user_id
    AND s.status IN ('active', 'paused', 'pending');

  IF v_tier_limit IS NULL THEN
    v_tier_limit := 0;
  END IF;

  IF v_existing_count >= v_tier_limit THEN
    -- Soft-revoke the new pair instead of aborting. We can't block
    -- the insert inside an AFTER trigger; this keeps the row but
    -- marks it so the edge function can return
    -- PARENT_CHILD_LIMIT_REACHED and the parent UI can show the
    -- upgrade prompt.
    UPDATE pairs
    SET status = 'revoked', revoked_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_child_device_limits_on_pairs
  AFTER INSERT OR UPDATE ON pairs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_child_device_limits_on_pairs();
