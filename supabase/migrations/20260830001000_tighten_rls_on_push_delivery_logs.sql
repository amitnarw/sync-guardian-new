-- ============================================================
-- Tighten Row-Level Security on tables that were missing it.
--
-- Supabase security advisor flagged `push_delivery_logs` as publicly
-- accessible. Enable RLS and revoke direct client access; all writes
-- happen via the `ingest-child-notification` edge function using
-- `service_role` which bypasses RLS.
--
-- `legal_documents` had a SELECT policy but no `GRANT SELECT` to
-- `authenticated`, so the policy had no effect. Add the grant so
-- authenticated users can read privacy/terms/license content.
--
-- These changes are idempotent and safe to re-run.
-- ============================================================

ALTER TABLE push_delivery_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE push_delivery_logs FROM authenticated;
REVOKE ALL ON TABLE push_delivery_logs FROM anon;

GRANT SELECT ON TABLE legal_documents TO authenticated;
