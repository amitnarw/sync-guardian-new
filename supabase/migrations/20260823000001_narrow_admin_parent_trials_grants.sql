-- ============================================================
-- Narrow grants on admin_parent_trials.
--
-- Default privileges auto-granted broad access to anon/authenticated
-- when the view was created. This view is an internal admin read
-- surface only (consumed via service_role by the admin panel and
-- dashboard stat), so strip everything else — mirrors the
-- narrow_rls_grants convention.
--
-- security_invoker=true means even if queried directly, underlying
-- user_trials RLS applies; this revoke is defense-in-depth.
-- ============================================================

REVOKE ALL ON public.admin_parent_trials FROM anon;
REVOKE ALL ON public.admin_parent_trials FROM authenticated;

GRANT SELECT ON public.admin_parent_trials TO service_role;
