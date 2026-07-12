-- ============================================================
-- Remove unused columns (audit: not read/written anywhere)
-- ============================================================

ALTER TABLE devices
  DROP COLUMN IF EXISTS app_version,
  DROP COLUMN IF EXISTS battery_optimization_disabled,
  DROP COLUMN IF EXISTS notification_permission_granted,
  DROP COLUMN IF EXISTS notification_listener_granted;

ALTER TABLE pairs
  DROP COLUMN IF EXISTS revoked_at;

ALTER TABLE mirrored_notifications
  DROP COLUMN IF EXISTS batch_id,
  DROP COLUMN IF EXISTS metadata_json;

ALTER TABLE push_delivery_logs
  DROP COLUMN IF EXISTS error_message;
