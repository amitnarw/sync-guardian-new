-- Enable Realtime for tables the Parent app subscribes to
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
ALTER PUBLICATION supabase_realtime ADD TABLE mirrored_notifications;

-- Enable Row Level Security on all tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirrored_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_app_filters ENABLE ROW LEVEL SECURITY;

-- Revoke default public grants from anon (keep service_role for edge functions)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
-- Grant anon only what's needed for auth
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE devices TO anon;
GRANT INSERT ON TABLE devices TO anon;
GRANT UPDATE ON TABLE devices TO anon;
GRANT SELECT, INSERT ON TABLE pairing_tokens TO anon;
GRANT UPDATE ON TABLE pairing_tokens TO anon;

-- ===================
-- devices policies
-- ===================
-- Users can read their own device
CREATE POLICY "users_read_own_device" ON devices
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own device
CREATE POLICY "users_update_own_device" ON devices
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own device during registration
CREATE POLICY "users_insert_own_device" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Parent can read their paired child device
CREATE POLICY "parent_read_child_device" ON devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE (pairs.parent_device_id = devices.id AND pairs.child_device_id = devices.id)
        AND EXISTS (
          SELECT 1 FROM devices AS parent_dev
          WHERE parent_dev.id = pairs.parent_device_id
            AND parent_dev.user_id = auth.uid()
        )
    )
  );

-- ===================
-- pairs policies
-- ===================
-- Users can read pairs linked to their devices
CREATE POLICY "users_read_own_pair" ON pairs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE (devices.id = pairs.parent_device_id OR devices.id = pairs.child_device_id)
        AND devices.user_id = auth.uid()
    )
  );

-- ===================
-- pairing_tokens policies
-- ===================
-- Child can read tokens they created
CREATE POLICY "child_read_own_token" ON pairing_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = pairing_tokens.child_device_id
        AND devices.user_id = auth.uid()
    )
  );

-- Anyone can read unconsumed token by code/token (needed for pairing)
CREATE POLICY "anyone_read_unconsumed_token" ON pairing_tokens
  FOR SELECT USING (consumed_at IS NULL AND expires_at > now());

-- ===================
-- mirrored_notifications policies
-- ===================
-- Users can read notifications belonging to their pair
CREATE POLICY "users_read_own_notifications" ON mirrored_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE pairs.id = mirrored_notifications.pair_id
        AND (
          EXISTS (
            SELECT 1 FROM devices
            WHERE devices.id = pairs.parent_device_id
              AND devices.user_id = auth.uid()
          ) OR EXISTS (
            SELECT 1 FROM devices
            WHERE devices.id = pairs.child_device_id
              AND devices.user_id = auth.uid()
          )
        )
    )
  );

-- ===================
-- child_app_filters policies
-- ===================
-- Parent can read filters for their child
CREATE POLICY "parent_read_child_filters" ON child_app_filters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE pairs.child_device_id = child_app_filters.child_device_id
        AND EXISTS (
          SELECT 1 FROM devices
          WHERE devices.id = pairs.parent_device_id
            AND devices.user_id = auth.uid()
        )
    )
  );
