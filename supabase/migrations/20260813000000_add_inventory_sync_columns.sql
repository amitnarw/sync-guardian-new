-- ============================================================
-- Track the child device's installed-app inventory sync outcome
-- directly on the pairs table, instead of inferring "has apps"
-- from the presence of child_app_filters rows.
--
-- This unblocks a real deadlock: a child device with no
-- social/messaging/dating apps installed never wrote any
-- child_app_filters rows, so the parent's wait screen polled
-- count>0 forever and never advanced to app selection.
--
-- child_inventory_synced_at:
--   Set whenever sync-installed-apps runs, even with 0 apps.
--   The parent polls THIS flag instead of child_app_filters.
-- child_monitorable_app_count:
--   How many whitelisted apps the child reported. 0 => parent
--   shows "no monitorable apps found" and can skip app selection.
-- parent_skipped_app_selection:
--   True when the parent saved with an empty changes array.
--   Lets the parent finish setup on devices with no monitorable apps.
-- ============================================================

ALTER TABLE pairs
  ADD COLUMN IF NOT EXISTS child_inventory_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS child_monitorable_app_count INTEGER,
  ADD COLUMN IF NOT EXISTS parent_skipped_app_selection BOOLEAN NOT NULL DEFAULT false;
