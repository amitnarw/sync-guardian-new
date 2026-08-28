-- ============================================================
-- Fix ambiguous parent_user_id in reconcile_child_device_limits
--
-- The function declares RETURNS TABLE (parent_user_id UUID, ...) so
-- PostgreSQL implicitly exposes a `parent_user_id` output column.
-- Inside the FOR ... IN SELECT DISTINCT parent_user_id FROM pairs
-- block, the unqualified column reference becomes ambiguous because
-- two columns named `parent_user_id` are now in scope: the output
-- table and the `pairs` row.
--
-- Qualify the column with the table alias to remove ambiguity. Same
-- fix applied to the inner COUNT queries and the PERFORM call.
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
  FOR v_parent IN
    SELECT DISTINCT p.parent_user_id AS parent_user_id
    FROM pairs p
    WHERE p.status IN ('active', 'pending')
  LOOP
    BEGIN
      SELECT COUNT(*)::INT INTO v_revoked_before
      FROM pairs p
      WHERE p.parent_user_id = v_parent.parent_user_id
        AND p.status = 'revoked';

      PERFORM enforce_child_device_limits(v_parent.parent_user_id);

      SELECT COUNT(*)::INT INTO v_revoked_after
      FROM pairs p
      WHERE p.parent_user_id = v_parent.parent_user_id
        AND p.status = 'revoked';

      v_delta := v_revoked_after - v_revoked_before;
      IF v_delta < 0 THEN v_delta := 0; END IF;
    EXCEPTION WHEN OTHERS THEN
      v_delta := 0;
      RAISE NOTICE 'reconcile: parent failed: %', SQLERRM;
    END;

    RETURN QUERY SELECT v_parent.parent_user_id, v_delta;
  END LOOP;
END;
$$;
