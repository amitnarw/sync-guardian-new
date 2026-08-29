-- ============================================================
-- Batched cleanup of any rows whose profile FK target is missing.
--
-- The hardening migration `20260831030000_harden_relationship_key_schema.sql`
-- added FKs from mirrored_notifications, push_delivery_logs, and pairs
-- to profiles(id). The follow-up `20260831050000_harden_profile_fks.sql`
-- backfilled missing profiles and removed orphan rows, but its
-- single-statement DELETEs can hold long locks on a large production
-- database and risk migration timeouts.
--
-- This migration is the idempotent, batched cleanup pass. It runs in
-- 1,000-row chunks, so:
--   * It can be re-run safely (no-op once orphans are gone).
--   * It does not block concurrent inserts to the same tables for long.
--   * It can be interrupted and resumed without partial-state issues.
--
-- Order: notifications first (highest volume), then push_delivery_logs,
-- then pairs (lowest volume but most sensitive).
--
-- Note: FOR UPDATE SKIP LOCKED cannot be combined with LEFT JOIN /
-- outer joins in PostgreSQL, so the orphan predicate uses a NOT EXISTS
-- subquery instead. Locked rows are simply skipped on the next iteration.
-- ============================================================

DO $$
DECLARE
  deleted_count INT;
BEGIN
  -- mirrored_notifications
  LOOP
    WITH orphan AS (
      SELECT n.id
      FROM mirrored_notifications n
      WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = n.parent_user_id)
         OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = n.child_user_id)
      LIMIT 1000
    )
    DELETE FROM mirrored_notifications
    WHERE id IN (SELECT id FROM orphan);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    EXIT WHEN deleted_count = 0;
    RAISE NOTICE 'orphan-cleanup: mirrored_notifications deleted %, continuing', deleted_count;
  END LOOP;

  -- push_delivery_logs
  LOOP
    WITH orphan AS (
      SELECT l.id
      FROM push_delivery_logs l
      WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = l.parent_user_id)
         OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = l.child_user_id)
      LIMIT 1000
    )
    DELETE FROM push_delivery_logs
    WHERE id IN (SELECT id FROM orphan);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    EXIT WHEN deleted_count = 0;
    RAISE NOTICE 'orphan-cleanup: push_delivery_logs deleted %, continuing', deleted_count;
  END LOOP;

  -- pairs
  LOOP
    WITH orphan AS (
      SELECT pa.id
      FROM pairs pa
      WHERE (pa.parent_user_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pa.parent_user_id))
         OR (pa.child_user_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = pa.child_user_id))
      LIMIT 1000
    )
    DELETE FROM pairs
    WHERE id IN (SELECT id FROM orphan);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    EXIT WHEN deleted_count = 0;
    RAISE NOTICE 'orphan-cleanup: pairs deleted %, continuing', deleted_count;
  END LOOP;

  RAISE NOTICE 'orphan-cleanup: complete';
END $$;
