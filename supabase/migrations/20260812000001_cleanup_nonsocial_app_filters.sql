-- ============================================================
-- Purge pre-existing child_app_filters rows for packages that fall
-- outside the new social-media / messaging / dating scope.
--
-- The list of supported packages is now sourced from app_categories
-- (added in the preceding migration), so this cleanup uses a subquery
-- rather than a hardcoded IN-list ,  it stays in sync forever as the
-- whitelist grows or shrinks via SQL.
--
-- Destructive: deletes child_app_filters rows. Runs as the migration
-- owner so RLS is bypassed (the owner is the appropriate role for a
-- one-time database cleanup).
-- ============================================================

DELETE FROM public.child_app_filters
WHERE package_name NOT IN (
  SELECT package_name
  FROM public.app_categories
  WHERE enabled = true
);
