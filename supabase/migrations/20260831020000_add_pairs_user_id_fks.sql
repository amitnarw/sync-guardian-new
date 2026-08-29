-- ============================================================
-- Add missing FKs from pairs.{parent_user_id, child_user_id}
-- to profiles.id so PostgREST can resolve the embedded join
-- `pairs.select('..., child_user:profiles!child_user_id(...)')`
-- used by the parent mobile app to fetch each paired child's
-- display name in a single query.
--
-- Without this FK, the join falls back to PGRST200 and
-- `loadAllChildren` returns empty rows. This caused the
-- parent Insights tab to show "Pair a child device" even
-- when a child was already paired.
-- ============================================================

ALTER TABLE pairs
  DROP CONSTRAINT IF EXISTS pairs_parent_user_id_fkey,
  ADD CONSTRAINT pairs_parent_user_id_fkey
    FOREIGN KEY (parent_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE pairs
  DROP CONSTRAINT IF EXISTS pairs_child_user_id_fkey,
  ADD CONSTRAINT pairs_child_user_id_fkey
    FOREIGN KEY (child_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
