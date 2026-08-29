-- ============================================================
-- Safe cleanup pass for any revoked pairs that survived
-- migration 20260831010000.
--
-- The original 20260831010000_delete_revoked_pairs.sql ran an
-- unconditional DELETE which could have removed rows whose
-- notifications were not yet re-encrypted with the relationship
-- key. This migration performs a guarded cleanup:
--
--   * Only deletes a revoked pair if its notifications are fully
--     re-encrypted (all encrypted fields start with `nv1:`) and
--     have non-null relationship columns.
--
--   * Leaves the pair in place if any notification still uses the
--     legacy pair_id encryption (no `nv1:` prefix), so we never
--     lose data that could still be decrypted with the old key.
--
--   * Runs in 1,000-row batches with FOR UPDATE SKIP LOCKED so it
--     can be safely re-run if interrupted.
--
-- Safe to run multiple times. Safe to run before backfill (just
-- deletes nothing in that case).
-- ============================================================

DO $$
DECLARE
  deleted_count INT;
BEGIN
  LOOP
    WITH safe_to_delete AS (
      SELECT p.id
      FROM pairs p
      WHERE p.status = 'revoked'
        AND NOT EXISTS (
          SELECT 1
          FROM mirrored_notifications n
          WHERE n.pair_id = p.id
            AND (
              n.parent_user_id IS NULL
              OR n.child_user_id IS NULL
              OR (
                n.notification_title IS NOT NULL
                AND n.notification_title <> ''
                AND n.notification_title NOT LIKE 'nv1:%'
              )
              OR (
                n.notification_body IS NOT NULL
                AND n.notification_body <> ''
                AND n.notification_body NOT LIKE 'nv1:%'
              )
              OR (
                n.source_package IS NOT NULL
                AND n.source_package <> ''
                AND n.source_package NOT LIKE 'nv1:%'
              )
              OR (
                n.source_app_name IS NOT NULL
                AND n.source_app_name <> ''
                AND n.source_app_name NOT LIKE 'nv1:%'
              )
            )
          LIMIT 1
        )
      LIMIT 1000
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM pairs
    WHERE id IN (SELECT id FROM safe_to_delete);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    EXIT WHEN deleted_count = 0;
    RAISE NOTICE 'safe-revoked-pair-cleanup: deleted % row(s), continuing...', deleted_count;
  END LOOP;
  RAISE NOTICE 'safe-revoked-pair-cleanup: complete';
END $$;
