-- ============================================================
-- Profiles table: user display names sourced from auth.users
-- Replaces the misused `device_name` column on `devices`.
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Keep profiles in sync with auth.users metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Backfill existing users
INSERT INTO public.profiles (id, display_name)
SELECT id, raw_user_meta_data->>'full_name'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. RLS: a user can read their own profile, and the profile of any
--    user they are paired with (mutual, non-recursive because `profiles`
--    is not referenced by any `pairs` policy).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_profile" ON profiles;
CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "read_paired_profile" ON profiles;
CREATE POLICY "read_paired_profile" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pairs
      WHERE (pairs.parent_user_id = auth.uid() AND pairs.child_user_id = profiles.id)
         OR (pairs.child_user_id = auth.uid() AND pairs.parent_user_id = profiles.id)
    )
  );

GRANT SELECT ON TABLE profiles TO authenticated;

-- 5. Update claim_pairing_token: drop the device-name parameter and
--    stop writing device_name (the column is removed below).
CREATE OR REPLACE FUNCTION claim_pairing_token(
  p_token TEXT,
  p_code TEXT,
  p_parent_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_token_data RECORD;
  v_parent_device_id UUID;
  v_child_user_id UUID;
  v_pair_id UUID;
  v_result JSONB;
BEGIN
  -- Lock the pairing_tokens row to prevent race condition
  IF p_token IS NOT NULL THEN
    SELECT INTO v_token_data *
    FROM pairing_tokens
    WHERE token = p_token
      AND consumed_at IS NULL
      AND expires_at > now()
    FOR UPDATE;
  ELSE
    SELECT INTO v_token_data *
    FROM pairing_tokens
    WHERE code = p_code
      AND consumed_at IS NULL
      AND expires_at > now()
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  -- Generate parent device ID
  v_parent_device_id := gen_random_uuid();

  -- Insert parent device (atomic with pair)
  INSERT INTO devices (
    id, user_id, role, platform
  )
  VALUES (
    v_parent_device_id, p_parent_user_id, 'parent', 'android'
  );

  -- Get child user_id
  SELECT user_id INTO v_child_user_id
  FROM devices WHERE id = v_token_data.child_device_id;

  IF v_child_user_id IS NULL THEN
    RAISE EXCEPTION 'Child device not found';
  END IF;

  -- Insert pair
  INSERT INTO pairs (
    parent_device_id, child_device_id, parent_user_id, child_user_id, status, paired_at
  )
  VALUES (
    v_parent_device_id, v_token_data.child_device_id,
    p_parent_user_id, v_child_user_id, 'active', now()
  )
  RETURNING id INTO v_pair_id;

  -- Mark token as consumed
  UPDATE pairing_tokens
  SET consumed_at = now(), pair_id = v_pair_id
  WHERE id = v_token_data.id;

  -- Return pair data
  SELECT jsonb_build_object(
    'id', p.id,
    'parent_device_id', p.parent_device_id,
    'child_device_id', p.child_device_id,
    'parent_user_id', p.parent_user_id,
    'child_user_id', p.child_user_id,
    'status', p.status,
    'paired_at', p.paired_at,
    'created_at', p.created_at,
    'updated_at', p.updated_at
  )
  INTO v_result
  FROM pairs p WHERE p.id = v_pair_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Remove the now-unused device_name column
ALTER TABLE devices DROP COLUMN IF EXISTS device_name;
