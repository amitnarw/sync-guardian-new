-- Fix RLS infinite recursion by adding user_id columns to pairs
-- and rewriting policies to avoid self-referencing queries.

-- 1. Add user_id columns to pairs
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS child_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Backfill existing pairs from devices table
UPDATE pairs
SET parent_user_id = d.user_id
FROM devices d
WHERE d.id = pairs.parent_device_id
  AND pairs.parent_user_id IS NULL;

UPDATE pairs
SET child_user_id = d.user_id
FROM devices d
WHERE d.id = pairs.child_device_id
  AND pairs.child_user_id IS NULL;

-- 3. Drop old recursive policies
DROP POLICY IF EXISTS "users_read_own_pair" ON pairs;
DROP POLICY IF EXISTS "parent_read_child_device" ON devices;
DROP POLICY IF EXISTS "users_read_own_notifications" ON mirrored_notifications;
DROP POLICY IF EXISTS "parent_read_child_filters" ON child_app_filters;

-- 4. Create non-recursive policies

-- pairs: user can read if they are the parent or child user
CREATE POLICY "users_read_own_pair" ON pairs
  FOR SELECT USING (parent_user_id = auth.uid() OR child_user_id = auth.uid());

-- devices: parent can read child device if they have a pair
CREATE POLICY "parent_read_child_device" ON devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE pairs.child_device_id = devices.id
        AND pairs.parent_user_id = auth.uid()
    )
  );

-- mirrored_notifications: user can read if they are parent or child in the pair
CREATE POLICY "users_read_own_notifications" ON mirrored_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE pairs.id = mirrored_notifications.pair_id
        AND (pairs.parent_user_id = auth.uid() OR pairs.child_user_id = auth.uid())
    )
  );

-- child_app_filters: parent can read their child's filters
CREATE POLICY "parent_read_child_filters" ON child_app_filters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE pairs.child_device_id = child_app_filters.child_device_id
        AND pairs.parent_user_id = auth.uid()
    )
  );
