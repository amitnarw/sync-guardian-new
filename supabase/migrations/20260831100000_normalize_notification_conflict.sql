-- ============================================================
-- Normalize the notification unique constraint to per-child-user.
--
-- Background:
--   The hardening migration `20260831000000_notification_parent_child_relationship.sql`
--   changed the unique constraint to
--     (parent_user_id, child_user_id, child_device_id, notification_key)
--   so the edge function's upsert would dedupe per child device.
--
--   A WhatsApp (or any other chat-app) message is bound to the CHILD
--   USER, not the physical device. If the same child user is signed
--   in on two devices (e.g., a phone and a tablet), the same chat
--   message arriving on both devices should produce ONE row in
--   `mirrored_notifications`, not two.
--
--   This migration drops `child_device_id` from the unique
--   constraint so the conflict target becomes
--     (parent_user_id, child_user_id, notification_key).
--
-- Effect on existing rows:
--   Existing rows may now violate the new constraint if the same
--   `(parent_user_id, child_user_id, notification_key)` triplet
--   appears twice (one per child device). We deduplicate before
--   re-adding the constraint by keeping the OLDEST row per triplet.
--   Because `push_sent_at` may differ between the duplicates, we
--   prefer the row with the most recent `push_sent_at` (or the
--   earliest `id` as a tiebreaker) so any prior successful push is
--   preserved.
-- ============================================================

-- 1. Check current constraint name for safety
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'mirrored_notifications'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%parent_user_id%child_user_id%child_device_id%notification_key%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    -- 2. Deduplicate before dropping. Keep one row per
    --    (parent_user_id, child_user_id, notification_key), preferring
    --    the row whose push was most recently sent, then the earliest
    --    ingested row.
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY parent_user_id, child_user_id, notification_key
          ORDER BY push_sent_at DESC NULLS LAST, ingested_at ASC NULLS LAST, id ASC
        ) AS rn
      FROM mirrored_notifications
    )
    DELETE FROM mirrored_notifications
    WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

    -- 3. Drop and recreate the constraint without child_device_id.
    EXECUTE format('ALTER TABLE mirrored_notifications DROP CONSTRAINT %I', cname);

    ALTER TABLE mirrored_notifications
      ADD CONSTRAINT unique_notification_key
      UNIQUE (parent_user_id, child_user_id, notification_key);
  END IF;
END $$;
