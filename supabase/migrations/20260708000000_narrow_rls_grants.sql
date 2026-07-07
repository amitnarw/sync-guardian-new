-- Revoke broad authenticated grants and narrow them per-table
-- Only edge functions (service_role) should perform mutations.
-- The mobile app reads via authenticated role with SELECT policies.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- Re-grant only what the mobile app needs directly
GRANT USAGE ON SCHEMA public TO authenticated;

-- devices: SELECT own device, UPDATE own device (for push_token/foreground sync)
GRANT SELECT, UPDATE ON TABLE devices TO authenticated;

-- pairs: SELECT own pairs (for pair resolution)
GRANT SELECT ON TABLE pairs TO authenticated;

-- mirrored_notifications: SELECT own notifications
GRANT SELECT ON TABLE mirrored_notifications TO authenticated;

-- pairing_tokens: SELECT own unconsumed tokens
GRANT SELECT ON TABLE pairing_tokens TO authenticated;

-- child_app_filters: SELECT own filters
GRANT SELECT ON TABLE child_app_filters TO authenticated;

-- Add UPDATE policy on devices (already has SELECT policy)
CREATE POLICY "users_update_own_device" ON devices
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Drop the overly permissive "anyone_read_unconsumed_token" policy
-- since token/code based lookup is handled by the SECURITY DEFINER RPC
DROP POLICY IF EXISTS "anyone_read_unconsumed_token" ON pairing_tokens;

-- Add index on mirrored_notifications for retention cleanup
CREATE INDEX IF NOT EXISTS idx_mirrored_notifications_posted_at
  ON mirrored_notifications (notification_posted_at DESC);
