-- ============================================================
-- Re-key notifications by parent_child relationship
--
-- Mirrored notifications previously used `pair_id` as both the
-- relationship pointer AND the encryption key seed. When a child
-- disconnects and reconnects, a new `pairs` row is created with
-- a new `pair_id`, so the parent's app cannot see historical
-- notifications.
--
-- This migration makes the parent-child user relationship the
-- stable identifier for notification history:
--   * Adds `parent_user_id` and `child_user_id` to
--     `mirrored_notifications` and `push_delivery_logs`.
--   * Removes the FK / ON DELETE CASCADE from
--     `mirrored_notifications.pair_id` so that deleting a revoked
--     pair row does not wipe historical notifications. `pair_id`
--     stays as a plain UUID column for audit / debugging only.
--   * Changes the unique constraint to the relationship key.
--   * Updates RLS so reads no longer depend on the `pairs` table.
--
-- After this migration deploys, run `backfill-encrypt-notifications`
-- to re-encrypt existing rows with the new relationship key
-- (decrypt with old pair_id key, encrypt with parent_child key).
-- Only after the backfill completes should the new edge functions
-- be deployed, otherwise old notifications will fail to decrypt.
-- ============================================================

-- 1. mirrored_notifications: add columns and backfill
ALTER TABLE mirrored_notifications
  ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS child_user_id UUID REFERENCES auth.users(id);

UPDATE mirrored_notifications n
SET parent_user_id = p.parent_user_id,
    child_user_id = p.child_user_id
FROM pairs p
WHERE n.pair_id = p.id
  AND (n.parent_user_id IS NULL OR n.child_user_id IS NULL);

ALTER TABLE mirrored_notifications
  ALTER COLUMN parent_user_id SET NOT NULL,
  ALTER COLUMN child_user_id SET NOT NULL;

-- 2. Change unique constraint to relationship key
ALTER TABLE mirrored_notifications
  DROP CONSTRAINT IF EXISTS unique_notification_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_notification_key'
      AND conrelid = 'mirrored_notifications'::regclass
  ) THEN
    ALTER TABLE mirrored_notifications
      ADD CONSTRAINT unique_notification_key
      UNIQUE (parent_user_id, child_user_id, child_device_id, notification_key);
  END IF;
END
$$;

-- 3. Detach pair_id FK so deleting revoked pairs does not wipe
--    historical notifications. Keep pair_id as a plain UUID for
--    audit / debugging.
ALTER TABLE mirrored_notifications
  DROP CONSTRAINT IF EXISTS mirrored_notifications_pair_id_fkey;

-- 4. Index for relationship-based history queries
CREATE INDEX IF NOT EXISTS idx_mirrored_notifications_parent_child
  ON mirrored_notifications (parent_user_id, child_user_id, notification_posted_at DESC);

-- 5. RLS: direct relationship check, no pairs dependency
DROP POLICY IF EXISTS "users_read_own_notifications" ON mirrored_notifications;

CREATE POLICY "users_read_own_notifications" ON mirrored_notifications
  FOR SELECT USING (
    parent_user_id = auth.uid() OR child_user_id = auth.uid()
  );

-- 6. push_delivery_logs: add relationship columns, detach pair_id
ALTER TABLE push_delivery_logs
  ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS child_user_id UUID REFERENCES auth.users(id);

UPDATE push_delivery_logs l
SET parent_user_id = p.parent_user_id,
    child_user_id = p.child_user_id
FROM pairs p
WHERE l.pair_id = p.id
  AND (l.parent_user_id IS NULL OR l.child_user_id IS NULL);

ALTER TABLE push_delivery_logs
  ALTER COLUMN parent_user_id SET NOT NULL,
  ALTER COLUMN child_user_id SET NOT NULL;

ALTER TABLE push_delivery_logs
  DROP CONSTRAINT IF EXISTS push_delivery_logs_pair_id_fkey;

ALTER TABLE push_delivery_logs
  ALTER COLUMN pair_id DROP NOT NULL;
