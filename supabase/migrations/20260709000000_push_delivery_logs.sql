-- Create push_delivery_logs table for tracking FCM delivery attempts
CREATE TABLE IF NOT EXISTS push_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES mirrored_notifications(id) ON DELETE SET NULL,
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  delivery_mode TEXT CHECK (delivery_mode IN ('parent_push', 'child_recovery_push')),
  status TEXT CHECK (status IN ('pending', 'success', 'failed', 'unregistered')) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for retry queries
CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_status
  ON push_delivery_logs (status, attempted_at)
  WHERE status IN ('pending', 'failed');

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_created_at
  ON push_delivery_logs (created_at DESC);
