-- Create devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('parent', 'child')) NOT NULL,
  platform TEXT DEFAULT 'android',
  device_name TEXT,
  app_version TEXT,
  push_token TEXT,
  is_foreground BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  battery_optimization_disabled BOOLEAN,
  notification_permission_granted BOOLEAN,
  notification_listener_granted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pairs table
CREATE TABLE pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  child_device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'active', 'revoked')) DEFAULT 'pending',
  paired_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create pairing_tokens table
CREATE TABLE pairing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  child_device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create child_app_filters table
CREATE TABLE child_app_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  package_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create mirrored_notifications table
CREATE TABLE mirrored_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE NOT NULL,
  child_device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  source_package TEXT,
  source_app_name TEXT,
  notification_title TEXT,
  notification_body TEXT,
  notification_posted_at TIMESTAMPTZ,
  ingested_at TIMESTAMPTZ DEFAULT now(),
  delivery_mode TEXT CHECK (delivery_mode IN ('realtime', 'push', 'both', 'pending')) DEFAULT 'pending',
  batch_id TEXT,
  metadata_json JSONB
);

-- Grant permissions to Supabase roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Enable Realtime for pairing_tokens so the Child device knows when it's paired
ALTER PUBLICATION supabase_realtime ADD TABLE pairing_tokens;
