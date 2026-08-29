-- ============================================================
-- Delete revoked pair rows after migration to relationship-key.
--
-- The notification migration (`20260831000000_notification_parent_child_relationship.sql`)
-- detached `mirrored_notifications.pair_id` from the `pairs` table FK,
-- so historical notifications are no longer at risk of cascade-delete.
-- Going forward, `revoke-pair` soft-revokes pairs (`status='revoked'`,
-- `revoked_at=now()`) rather than deleting them. This migration only
-- cleans up historical revoked rows, and ONLY when it is safe to do so:
--
--   1. All of the pair's `mirrored_notifications` rows have non-null
--      `parent_user_id` and `child_user_id` (relationship columns are
--      populated by migration 20260831000000...).
--
--   2. All encrypted content fields (`notification_title`,
--      `notification_body`, `source_package`, `source_app_name`) on
--      those rows start with the `nv1:` prefix, meaning the backfill
--      has re-encrypted them with the new relationship key.
--
--   3. No notifications still reference the pair using the legacy
--      `pairs` FK (it has been detached, so this is a sanity check).
--
-- If any of these conditions are not met for a given revoked pair, the
-- row is left in place so the relationship-key migration can complete
-- safely. A follow-up migration or manual runbook step can clean it
-- up once the data is verified.
-- ============================================================

DELETE FROM pairs p
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
  );
