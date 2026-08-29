-- ============================================================
-- Harden profile FK setup so relationship-key migrations
-- never abort on missing profiles.
--
-- The hardening migration `20260831030000_...` added FKs from
-- mirrored_notifications / push_delivery_logs / pairs to profiles(id).
-- If any auth.users row was created before the `handle_new_user`
-- trigger was in place (or if the trigger is ever re-created), the
-- migration would fail because profiles.id is missing for that user.
--
-- This migration:
--   1. Defensively backfills profiles for any auth.users row missing one.
--   2. Ensures the `handle_new_user` trigger is in place on auth.users
--      and is `ON CONFLICT DO NOTHING` safe.
--   3. Drops any orphaned pairs / mirrored_notifications / push_delivery_logs
--      rows whose user-id FK target is missing (defensive cleanup so the
--      FKs we just added in earlier migrations cannot be invalidated by
--      a subsequent auth.users delete that left orphaned rows behind).
-- ============================================================

-- 1. Backfill missing profile rows for any auth.users.
INSERT INTO public.profiles (id, display_name)
SELECT au.id, au.raw_user_meta_data->>'full_name'
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Trigger idempotency check.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Defensive cleanup. If a profile row was ever deleted while
-- notifications still referenced the user, the FKs added in the
-- hardening migration would now block DELETE. We only clean orphans
-- whose profile is genuinely missing.
DELETE FROM public.mirrored_notifications n
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = n.parent_user_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = n.child_user_id);

DELETE FROM public.push_delivery_logs l
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.parent_user_id)
   OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = l.child_user_id);

DELETE FROM public.pairs pa
WHERE (pa.parent_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pa.parent_user_id))
   OR (pa.child_user_id  IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = pa.child_user_id));
