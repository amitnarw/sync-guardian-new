-- ============================================================
-- Parent-only trials.
--
-- Trials are a billing concept: only parent devices purchase
-- subscriptions and consume the 7-day trial. Children never see
-- subscription or money UI — their access is derived from their
-- paired parent's state (see get-my-subscription edge function).
--
-- 1. Backfill: drop trials belonging to children (paired as child
--    or marked role=child in onboarding state).
-- 2. Trigger: selecting role 'child' removes the user's trial row,
--    so children created after this migration stay clean too.
-- 3. View admin_parent_trials: trials of non-children only. Used by
--    the admin panel (list/show reads) and the dashboard stat so
--    pagination counts parents only.
--
-- Notes:
-- - Writes still target the base user_trials table (admin edit/
--   delete flows); only reads use the view.
-- - A child who later flips to parent does not get a trial
--   resurrected; grant one manually in the admin if ever needed.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. Backfill: remove child trials
-- ------------------------------------------------------------------
DELETE FROM public.user_trials t
WHERE EXISTS (
      SELECT 1 FROM public.pairs p WHERE p.child_user_id = t.user_id)
   OR EXISTS (
      SELECT 1 FROM public.user_onboarding_state o
      WHERE o.user_id = t.user_id AND o.selected_role = 'child');

-- ------------------------------------------------------------------
-- 2. Keep it clean going forward: role 'child' => no trial row
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_child_role_trial_cleanup()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.user_trials WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_child_role_trial_removed ON public.user_onboarding_state;
CREATE TRIGGER on_child_role_trial_removed
  AFTER INSERT OR UPDATE OF selected_role ON public.user_onboarding_state
  FOR EACH ROW
  WHEN (NEW.selected_role = 'child')
  EXECUTE FUNCTION handle_child_role_trial_cleanup();

-- ------------------------------------------------------------------
-- 3. Parent-only trials view (admin reads + dashboard stat)
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.admin_parent_trials
WITH (security_invoker = true) AS
SELECT t.*
FROM public.user_trials t
WHERE NOT EXISTS (
      SELECT 1 FROM public.pairs p WHERE p.child_user_id = t.user_id)
  AND NOT EXISTS (
      SELECT 1 FROM public.user_onboarding_state o
      WHERE o.user_id = t.user_id AND o.selected_role = 'child');

GRANT SELECT ON public.admin_parent_trials TO service_role;
