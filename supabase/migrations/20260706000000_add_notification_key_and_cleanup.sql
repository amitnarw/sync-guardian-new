-- Add notification_key column for deduplication
ALTER TABLE mirrored_notifications ADD COLUMN IF NOT EXISTS notification_key TEXT;

-- Create unique constraint for dedup (replaces the index)
DROP INDEX IF EXISTS idx_mirrored_notifications_dedup;
ALTER TABLE mirrored_notifications DROP CONSTRAINT IF EXISTS unique_notification_key;
ALTER TABLE mirrored_notifications ADD CONSTRAINT unique_notification_key
  UNIQUE (pair_id, child_device_id, notification_key);

-- Add unique constraint on devices (one device per user+role)
ALTER TABLE devices DROP CONSTRAINT IF EXISTS unique_user_role;
ALTER TABLE devices ADD CONSTRAINT unique_user_role UNIQUE (user_id, role);

-- Add unique constraints on pairing_tokens
ALTER TABLE pairing_tokens DROP CONSTRAINT IF EXISTS unique_token;
ALTER TABLE pairing_tokens ADD CONSTRAINT unique_token UNIQUE (token);
ALTER TABLE pairing_tokens DROP CONSTRAINT IF EXISTS unique_active_code;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_code ON pairing_tokens (code) WHERE consumed_at IS NULL;

-- Make user_id columns NOT NULL
ALTER TABLE devices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE pairs ALTER COLUMN parent_user_id SET NOT NULL;
ALTER TABLE pairs ALTER COLUMN child_user_id SET NOT NULL;

-- Add essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices (user_id);
CREATE INDEX IF NOT EXISTS idx_pairs_parent_user_id ON pairs (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_pairs_child_user_id ON pairs (child_user_id);
CREATE INDEX IF NOT EXISTS idx_pairs_parent_device_id ON pairs (parent_device_id);
CREATE INDEX IF NOT EXISTS idx_pairs_child_device_id ON pairs (child_device_id);
CREATE INDEX IF NOT EXISTS idx_mirrored_notifications_pair_id ON mirrored_notifications (pair_id);
CREATE INDEX IF NOT EXISTS idx_pairing_tokens_expires ON pairing_tokens (expires_at) WHERE consumed_at IS NULL;

-- Remove pairing_tokens from Realtime (insecure — codes exposed to anon)
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS pairing_tokens;

-- Drop the insecure "anyone can read unconsumed token" policy
DROP POLICY IF EXISTS "anyone_read_unconsumed_token" ON pairing_tokens;

-- Auto-update updated_at on all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_devices_updated_at') THEN
    CREATE TRIGGER set_devices_updated_at BEFORE UPDATE ON devices
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pairs_updated_at') THEN
    CREATE TRIGGER set_pairs_updated_at BEFORE UPDATE ON pairs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_mirrored_notifications_updated_at') THEN
    CREATE TRIGGER set_mirrored_notifications_updated_at BEFORE UPDATE ON mirrored_notifications
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_child_app_filters_updated_at') THEN
    CREATE TRIGGER set_child_app_filters_updated_at BEFORE UPDATE ON child_app_filters
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- Remove old migration file