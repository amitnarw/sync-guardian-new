-- ============================================================
-- Harden the relationship-key schema for production readiness
--
-- Post-migration cleanup from the parent/child relationship-key
-- refactor (20260831000000...). This fixes:
--
--   1. Missing FKs from mirrored_notifications and
--      push_delivery_logs to profiles(id). Without these, PostgREST
--      cannot resolve embedded joins like `parent_user:profiles!
--      parent_user_id(...)` that the admin panel and mobile
--      notification-detail views rely on. The columns were added
--      with REFERENCES auth.users(id), but PostgREST joins resolve
--      against the FK target; we want profiles so display_name and
--      other profile columns can be embedded.
--
--   2. push_delivery_logs has RLS enabled but no SELECT policy,
--      making it inaccessible to all roles. Add a relationship-scoped
--      policy so parent/child can read their own logs.
--
--   3. Missing covering indexes for the new relationship-key queries
--      (child_user_id lookups in mobile realtime filters and
--      parent_user_id/child_user_id lookups in admin dashboards).
--
--   4. pairs.revoked_at was dropped in 20260717000000_remove_unused_columns.sql
--      but is still referenced by SQL functions
--      (enforce_child_device_limits, claim_pairing_token) and by
--      sync-revocation paths. Re-add the column to silence those
--      broken references and give us an audit timestamp for soft
--      revocation.
--
--   5. subscriptions.revoked_at does not exist either, but the
--      cancel-subscription edge function writes to it. Add the column.
--
--   6. claim_pairing_token generates a fresh parent device id each
--      claim; on re-pair the unique_user_role constraint blocks the
--      insert. Patch the function to reuse an existing parent device
--      row before inserting.
-- ============================================================

-- 1. Mirror FKs: point mirrored_notifications/push_delivery_logs
--    parent_user_id and child_user_id at profiles(id) so PostgREST
--    can resolve embedded joins to profiles.
ALTER TABLE mirrored_notifications
  DROP CONSTRAINT IF EXISTS mirrored_notifications_parent_user_id_fkey,
  DROP CONSTRAINT IF EXISTS mirrored_notifications_child_user_id_fkey;

ALTER TABLE mirrored_notifications
  ADD CONSTRAINT mirrored_notifications_parent_user_id_fkey
    FOREIGN KEY (parent_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT mirrored_notifications_child_user_id_fkey
    FOREIGN KEY (child_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE push_delivery_logs
  DROP CONSTRAINT IF EXISTS push_delivery_logs_parent_user_id_fkey,
  DROP CONSTRAINT IF EXISTS push_delivery_logs_child_user_id_fkey;

ALTER TABLE push_delivery_logs
  ADD CONSTRAINT push_delivery_logs_parent_user_id_fkey
    FOREIGN KEY (parent_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT push_delivery_logs_child_user_id_fkey
    FOREIGN KEY (child_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. push_delivery_logs: relationship-scoped SELECT policy. RLS is
--    already enabled and direct grants were revoked in
--    20260830001000_tighten_rls_on_push_delivery_logs.sql, but no
--    policy exists so authenticated users cannot read their logs.
DROP POLICY IF EXISTS "users_read_own_delivery_logs" ON push_delivery_logs;

CREATE POLICY "users_read_own_delivery_logs" ON push_delivery_logs
  FOR SELECT USING (
    parent_user_id = auth.uid() OR child_user_id = auth.uid()
  );

-- 3. Missing indexes for relationship-key lookups.
CREATE INDEX IF NOT EXISTS idx_mirrored_notifications_child_user_id
  ON mirrored_notifications (child_user_id, notification_posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_mirrored_notifications_parent_user_id
  ON mirrored_notifications (parent_user_id, notification_posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_parent_child
  ON push_delivery_logs (parent_user_id, child_user_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_notification_id
  ON push_delivery_logs (notification_id);

-- 4. Re-add pairs.revoked_at as audit timestamp. Default to NULL on
--    existing rows (they were never soft-revoked).
ALTER TABLE pairs
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- 5. subscriptions.revoked_at: written by cancel-subscription.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- 6. claim_pairing_token: reuse an existing parent device row for
--    the same user. The original function always generates a new
--    UUID, which collides with unique_user_role on re-pair. The fix
--    below makes the function idempotent for the same user.
CREATE OR REPLACE FUNCTION public.claim_pairing_token(
  p_token text,
  p_parent_user_id uuid
) RETURNS TABLE (
  pair_id uuid,
  child_user_id uuid,
  child_device_id uuid,
  parent_setup_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_row pairing_tokens%ROWTYPE;
  v_pair_id uuid;
  v_child_user_id uuid;
  v_child_device_id uuid;
  v_parent_device_id uuid;
  v_existing_pair uuid;
BEGIN
  -- Lock the token row to prevent concurrent claims.
  SELECT * INTO v_token_row
  FROM pairing_tokens
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN' USING ERRCODE = 'P0001';
  END IF;

  IF v_token_row.consumed_at IS NOT NULL THEN
    RAISE EXCEPTION 'TOKEN_CONSUMED' USING ERRCODE = 'P0001';
  END IF;

  -- Reuse the parent's existing parent device row if present. The
  -- unique_user_role constraint would otherwise block re-pairing
  -- after a previous revoke.
  SELECT id INTO v_parent_device_id
  FROM devices
  WHERE user_id = p_parent_user_id AND role = 'parent'
  LIMIT 1;

  IF v_parent_device_id IS NULL THEN
    v_parent_device_id := gen_random_uuid();
    INSERT INTO devices (id, user_id, role, platform, last_seen_at, is_foreground)
    VALUES (v_parent_device_id, p_parent_user_id, 'parent', 'android', now(), true);
  ELSE
    -- Bump last_seen_at so the parent device row stays current.
    UPDATE devices SET last_seen_at = now() WHERE id = v_parent_device_id;
  END IF;

  -- Soft-revoke any existing active pair for the same child device so
  -- tier-limit triggers don't double-count history. Set revoked_at.
  UPDATE pairs
  SET status = 'revoked', revoked_at = now()
  WHERE child_device_id = v_token_row.child_device_id
    AND status = 'active';

  INSERT INTO pairs (
    parent_device_id, child_device_id, status, paired_at
  ) VALUES (
    v_parent_device_id, v_token_row.child_device_id, 'active', now()
  )
  RETURNING id, parent_user_id, child_user_id
  INTO v_pair_id, p_parent_user_id, v_child_user_id;

  -- Stamp child_user_id back onto the pair row (the assignment above
  -- mutates the OUT parameter rather than the column).
  UPDATE pairs SET child_user_id = v_child_user_id WHERE id = v_pair_id;

  UPDATE pairing_tokens
  SET consumed_at = now(), pair_id = v_pair_id
  WHERE id = v_token_row.id;

  -- Read back the pair row to surface parent_setup_completed.
  SELECT child_user_id, child_device_id, parent_setup_completed
  INTO v_child_user_id, v_child_device_id, parent_setup_completed
  FROM pairs WHERE id = v_pair_id;

  RETURN QUERY SELECT v_pair_id, v_child_user_id, v_child_device_id,
                       COALESCE(parent_setup_completed, false);
END;
$$;

-- 7. Pair with the relationship-key refactor: tighten
--    enforce_child_device_limits to use revoked_at (now available).
CREATE OR REPLACE FUNCTION public.enforce_child_device_limits()
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

  -- Count existing active pairs for this child device across all
  -- parents, excluding revoked ones. Soft-revoked pairs use the
  -- new revoked_at column as the audit timestamp.
  SELECT count(*) INTO v_existing_count
  FROM pairs
  WHERE child_device_id = NEW.child_device_id
    AND status = 'active'
    AND id <> NEW.id;

  -- Look up the parent's tier limit via their active subscription
  -- or trial. We assume a default limit of 3 if no record is found.
  SELECT COALESCE(MAX(s.tier_child_device_limit), 3) INTO v_tier_limit
  FROM subscriptions s
  WHERE s.user_id = NEW.parent_user_id
    AND s.status IN ('active', 'paused', 'pending');

  IF v_existing_count >= v_tier_limit THEN
    -- Soft-revoke the new pair instead of aborting. We can't block the
    -- insert inside an AFTER trigger; this keeps the row but marks it.
    UPDATE pairs
    SET status = 'revoked', revoked_at = now()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
