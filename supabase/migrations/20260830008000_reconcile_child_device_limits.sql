-- ============================================================
-- Compensating child-device-limit enforcement (RPC + cron)
--
-- The enforce_child_device_limits() trigger runs synchronously
-- inside the same transaction as the subscriptions / user_trials
-- mutation. We wrapped its UPDATE body in EXCEPTION to keep the
-- parent mutation from aborting when the inner UPDATE fails
-- (lock timeout, serialization error, etc.), but that means
-- enforcement can be silently skipped under contention.
--
-- This migration adds:
--   1. reconcile_child_device_limits() ,  bulk re-enforcement for
--      every parent who currently has any active/pending pair.
--   2. A scheduled invocation via pg_cron (every 10 minutes) when
--      the extension is enabled. In Supabase projects where
--      pg_cron isn't enabled, the CREATE EXTENSION call is a no-op
--      (already-enabled errors are ignored) and the cron job will
--      simply not be registered; the function can still be invoked
--      manually for one-off reconciliation.
-- ============================================================

CREATE OR REPLACE FUNCTION reconcile_child_device_limits()
RETURNS TABLE (parent_user_id UUID, revoked_pair_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent RECORD;
  v_revoked_before INT;
  v_revoked_after INT;
  v_delta INT;
BEGIN
  -- Iterate over every parent that currently has at least one
  -- non-revoked pair. We deliberately do NOT run enforcement for
  -- parents with zero pairs: their tier limits are vacuously met.
  FOR v_parent IN
    SELECT DISTINCT parent_user_id
    FROM pairs
    WHERE status IN ('active', 'pending')
  LOOP
    BEGIN
      -- Snapshot revoked count BEFORE enforcement so we can return
      -- the delta actually caused by this run (not pairs revoked
      -- manually in the last few minutes).
      SELECT COUNT(*)::INT INTO v_revoked_before
      FROM pairs
      WHERE parent_user_id = v_parent.parent_user_id
        AND status = 'revoked';

      -- Re-run enforcement. Errors are swallowed (per the earlier
      -- hardening) so a single bad row doesn't break the loop.
      PERFORM enforce_child_device_limits(v_parent.parent_user_id);

      SELECT COUNT(*)::INT INTO v_revoked_after
      FROM pairs
      WHERE parent_user_id = v_parent.parent_user_id
        AND status = 'revoked';

      v_delta := v_revoked_after - v_revoked_before;
      IF v_delta < 0 THEN v_delta := 0; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_delta := 0;
      RAISE NOTICE 'reconcile: parent % failed: %', v_parent.parent_user_id, SQLERRM;
    END;

    RETURN QUERY SELECT v_parent.parent_user_id, v_delta;
  END LOOP;
END;
$$;

-- -------------------------------------------------------------
-- pg_cron schedule (best-effort)
-- -------------------------------------------------------------
--
-- Wrapped in DO blocks so projects without pg_cron enabled simply
-- skip scheduling. The reconcile function remains callable manually
-- via:
--   SELECT * FROM reconcile_child_device_limits();
--
DO $do$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron extension not available; skipping schedule registration';
    RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('reconcile-child-device-limits');
  EXCEPTION WHEN OTHERS THEN
    -- Job did not exist; ignore.
    NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'reconcile-child-device-limits',
      '*/10 * * * *',
      $cron$ SELECT count(*) FROM reconcile_child_device_limits() $cron$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron.schedule failed: %', SQLERRM;
  END;
END
$do$;
