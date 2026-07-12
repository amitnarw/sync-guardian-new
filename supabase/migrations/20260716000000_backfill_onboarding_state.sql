-- ============================================================
-- Backfill onboarding state for users who already have an
-- active pair from before this table existed.
-- ============================================================

INSERT INTO user_onboarding_state (user_id, selected_role, onboarding_step, onboarding_completed)
SELECT DISTINCT ON (d.user_id)
  d.user_id,
  d.role::text,
  'completed',
  true
FROM devices d
JOIN pairs p ON (p.parent_device_id = d.id OR p.child_device_id = d.id)
WHERE p.status = 'active'
  AND d.user_id IS NOT NULL
ORDER BY d.user_id, d.role
ON CONFLICT (user_id) DO UPDATE
  SET onboarding_step = EXCLUDED.onboarding_step,
      onboarding_completed = EXCLUDED.onboarding_completed,
      selected_role = COALESCE(user_onboarding_state.selected_role, EXCLUDED.selected_role);
