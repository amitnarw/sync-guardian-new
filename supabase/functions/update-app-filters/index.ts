import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { isValidUUID, isValidString, sanitizeString } from '../_shared/validation.ts'
import { upsertOnboardingState } from '../_shared/onboarding-state.ts'
import { logger, mapError } from '../_shared/logger.ts'

interface FilterChange {
  package_name: string
  is_enabled: boolean
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()
    const childDeviceId = sanitizeString(body.child_device_id, 100)

    if (!isValidUUID(childDeviceId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid child_device_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    if (!Array.isArray(body.changes)) {
      return new Response(
        JSON.stringify({ error: 'changes array is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const changes: FilterChange[] = body.changes.slice(0, 2000).filter(
      (c: any) => isValidString(c?.package_name, 200) && typeof c?.is_enabled === 'boolean',
    )

    if (changes.length === 0) {
      return new Response(
        JSON.stringify({ data: { updated: 0 } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    // Verify the caller is the parent paired to this child device.
    const { data: pair } = await adminClient
      .from('pairs')
      .select('id, status')
      .eq('child_device_id', childDeviceId)
      .eq('parent_user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!pair) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to manage filters for this device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    const enabledPkgs = changes.filter((c) => c.is_enabled).map((c) => sanitizeString(c.package_name, 200))
    const disabledPkgs = changes.filter((c) => !c.is_enabled).map((c) => sanitizeString(c.package_name, 200))

    const updateGroup = async (pkgs: string[], value: boolean) => {
      if (pkgs.length === 0) return 0
      const { error } = await adminClient
        .from('child_app_filters')
        .update({ is_enabled: value })
        .eq('child_device_id', childDeviceId)
        .in('package_name', pkgs)
      if (error) throw error
      return pkgs.length
    }

    const enabledCount = await updateGroup(enabledPkgs, true)
    const disabledCount = await updateGroup(disabledPkgs, false)
    const updated = enabledCount + disabledCount

    // Mark the pair's initial setup as completed so the child device can
    // leave its "waiting for parent" state.
    const { error: pairErr } = await adminClient
      .from('pairs')
      .update({ parent_setup_completed: true })
      .eq('child_device_id', childDeviceId)
      .eq('parent_user_id', user.id)
    if (pairErr) throw pairErr

    // Onboarding is now complete for both users.
    try {
      await upsertOnboardingState(user.id, {
        onboarding_step: 'completed',
        onboarding_completed: true,
      })
      const { data: childPair } = await adminClient
        .from('pairs')
        .select('child_user_id')
        .eq('child_device_id', childDeviceId)
        .eq('parent_user_id', user.id)
        .single()
      if (childPair?.child_user_id) {
        await upsertOnboardingState(childPair.child_user_id, {
          onboarding_step: 'completed',
          onboarding_completed: true,
        })
      }
    } catch (obErr) {
      logger.warn('update-app-filters', 'onboarding upsert failed', { error: String(obErr) })
    }

    logger.info('update-app-filters', 'updated app filters', { updated })

    return new Response(
      JSON.stringify({ data: { updated } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('update-app-filters', safeMsg, error instanceof Error ? error.message : '')
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
