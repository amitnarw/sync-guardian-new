-- Ensure mirrored_notifications has a notification_key column and a unique
-- constraint matching the ON CONFLICT clause used by the
-- ingest-child-notification edge function: (pair_id, child_device_id, notification_key).
--
-- This is idempotent so it is safe to re-apply even if the earlier migration
-- partially applied. Without this constraint, upsert() fails with:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"

ALTER TABLE mirrored_notifications ADD COLUMN IF NOT EXISTS notification_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'unique_notification_key'
      AND conrelid = 'mirrored_notifications'::regclass
  ) THEN
    ALTER TABLE mirrored_notifications
      ADD CONSTRAINT unique_notification_key
      UNIQUE (pair_id, child_device_id, notification_key);
  END IF;
END
$$;
