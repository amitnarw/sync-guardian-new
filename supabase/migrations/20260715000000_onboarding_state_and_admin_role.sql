-- ============================================================
-- Onboarding state + admin role support
-- ============================================================

-- 1. Allow 'admin' as a device role
ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_role_check;

ALTER TABLE devices
  ADD CONSTRAINT devices_role_check
  CHECK (role IN ('parent', 'child', 'admin'));

-- 2. Create user_onboarding_state: single source of truth for where a user
--    is in the onboarding flow. Survives reinstalls because it lives in the DB.
CREATE TABLE IF NOT EXISTS user_onboarding_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_role TEXT CHECK (selected_role IN ('parent', 'child', 'admin')),
  onboarding_step TEXT CHECK (
    onboarding_step IN ('role_selection', 'pairing', 'permissions', 'app_selection', 'completed')
  ) DEFAULT 'role_selection',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_user_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_onboarding_state_updated_at ON user_onboarding_state;

CREATE TRIGGER set_user_onboarding_state_updated_at
  BEFORE UPDATE ON user_onboarding_state
  FOR EACH ROW
  EXECUTE FUNCTION set_user_onboarding_state_updated_at();

-- 3. Row Level Security
ALTER TABLE user_onboarding_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_own_onboarding_state" ON user_onboarding_state;
CREATE POLICY "user_read_own_onboarding_state" ON user_onboarding_state
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_insert_own_onboarding_state" ON user_onboarding_state;
CREATE POLICY "user_insert_own_onboarding_state" ON user_onboarding_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_update_own_onboarding_state" ON user_onboarding_state;
CREATE POLICY "user_update_own_onboarding_state" ON user_onboarding_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Grants (mobile app uses authenticated role with SELECT/INSERT/UPDATE)
GRANT SELECT, INSERT, UPDATE ON TABLE user_onboarding_state TO authenticated;

-- 5. Realtime so the child waiting screen can reflect parent progress
ALTER PUBLICATION supabase_realtime ADD TABLE user_onboarding_state;
