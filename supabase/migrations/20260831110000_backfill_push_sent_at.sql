-- ============================================================
-- Backfill push_sent_at for existing rows.
--
-- The `ingest-child-notification` edge function now uses the
-- `push_sent_at` column to decide whether a notification was already
-- pushed (skip) or is fresh (push + stamp). All existing rows were
-- inserted before this column existed, so they have `push_sent_at =
-- NULL` and would be re-pushed on the next ingest that returns them
-- (as upsert conflicts do).
--
-- For these legacy rows we treat them as "already pushed" by
-- stamping push_sent_at with their ingested_at timestamp. This
-- preserves the at-most-once guarantee for any prior push attempt
-- that happened through the old code path.
-- ============================================================

UPDATE mirrored_notifications
SET push_sent_at = ingested_at
WHERE push_sent_at IS NULL
  AND ingested_at IS NOT NULL;
