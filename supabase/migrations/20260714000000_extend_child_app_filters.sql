-- Extend child_app_filters to store the full installed-app inventory
-- reported by the child device (Android launcher apps only).

-- App display metadata sent by the child device
ALTER TABLE child_app_filters ADD COLUMN IF NOT EXISTS app_name TEXT;
ALTER TABLE child_app_filters ADD COLUMN IF NOT EXISTS app_icon_base64 TEXT;

-- Unique device + package so the child upsert can preserve is_enabled on conflict
ALTER TABLE child_app_filters DROP CONSTRAINT IF EXISTS unique_device_package;
ALTER TABLE child_app_filters ADD CONSTRAINT unique_device_package
  UNIQUE (child_device_id, package_name);

-- Add child_app_filters to Realtime so the child device can subscribe to
-- parent filter changes and cache the enabled app set locally.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'child_app_filters'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.child_app_filters;
  END IF;
END $$;
