-- Track whether the parent has completed the initial app-selection setup
-- so the child device can show a "waiting for parent" state until then.
ALTER TABLE pairs ADD COLUMN IF NOT EXISTS parent_setup_completed BOOLEAN DEFAULT false;
