-- Create atomic claim_pairing_token function to prevent race conditions
CREATE OR REPLACE FUNCTION claim_pairing_token(
  p_token TEXT,
  p_code TEXT,
  p_parent_user_id UUID,
  p_parent_device_name TEXT
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
    id, user_id, role, device_name, platform
  )
  VALUES (
    v_parent_device_id, p_parent_user_id, 'parent', COALESCE(p_parent_device_name, 'Parent Device'), 'android'
  );

  -- Get child user_id
  SELECT user_id INTO v_child_user_id
  FROM devices WHERE id = v_token_data.child_device_id;

  IF v_child_user_id IS NULL THEN
    RAISE EXCEPTION 'Child device not found';
  END IF;

  -- Insert pair
  INSERT INTO pairs (
    parent_device_id, child_device_id, parent_user_id, child_user_id, status
  )
  VALUES (
    v_parent_device_id, v_token_data.child_device_id,
    p_parent_user_id, v_child_user_id, 'active'
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
