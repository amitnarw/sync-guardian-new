import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { isValidUUID, isValidString, sanitizeString } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'
import { getEnabledAppCategories } from '../_shared/app-categories-cache.ts'

interface IncomingApp {
  package_name: string
  app_name?: string | null
  app_icon_base64?: string | null
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

    if (!Array.isArray(body.apps)) {
      return new Response(
        JSON.stringify({ error: 'apps array is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // The child device may have a large app inventory; cap to a sane limit.
    const apps: IncomingApp[] = body.apps.slice(0, 2000)

    const { data: childDevice } = await adminClient
      .from('devices')
      .select('user_id, role')
      .eq('id', childDeviceId)
      .single()

    if (!childDevice || childDevice.role !== 'child' || childDevice.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to sync apps for this device' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 },
      )
    }

    // Resolve the active/pending pair for this child device so we can record
    // the inventory sync outcome directly on the pair row.
    const { data: pair } = await adminClient
      .from('pairs')
      .select('id')
      .eq('child_device_id', childDeviceId)
      .in('status', ['active', 'pending'])
      .order('paired_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Load existing filters so we preserve parent-chosen is_enabled values.
    const { data: existing } = await adminClient
      .from('child_app_filters')
      .select('package_name, is_enabled')
      .eq('child_device_id', childDeviceId)

    const existingEnabled = new Map<string, boolean>(
      (existing ?? []).map((r: { package_name: string; is_enabled: boolean }) => [r.package_name, r.is_enabled]),
    )

    // Load the social-media / messaging / dating whitelist from the DB
    // (cached in-memory for 5 minutes). Filters incoming apps so only
    // supported packages are written into child_app_filters.
    const { packages: allowedPackages } = await getEnabledAppCategories(adminClient)

    const incomingPackages = new Set<string>()
    const rows = apps
      .filter(
        (a) =>
          isValidString(a.package_name, 200) &&
          allowedPackages.has(a.package_name),
      )
      .map((a) => {
        const packageName = sanitizeString(a.package_name, 200)
        incomingPackages.add(packageName)
        const wasKnown = existingEnabled.has(packageName)
        return {
          child_device_id: childDeviceId,
          package_name: packageName,
          app_name: sanitizeString(a.app_name, 200) || null,
          app_icon_base64: sanitizeString(a.app_icon_base64 as string, 500000) || null,
          // New social-media apps mirror by default (parent opts out). Existing
          // apps keep their prior state so a parent-initiated toggle isn't
          // overwritten.
          is_enabled: wasKnown ? (existingEnabled.get(packageName) ?? true) : true,
        }
      })

    if (rows.length > 0) {
      const { error: upsertError } = await adminClient
        .from('child_app_filters')
        .upsert(rows, { onConflict: 'child_device_id, package_name' })
      if (upsertError) throw upsertError
    }

    // Remove rows for apps no longer present on the child device (except
    // those the parent explicitly enabled ,  don't undo parent choices).
    if (incomingPackages.size > 0) {
      await adminClient
        .from('child_app_filters')
        .delete()
        .eq('child_device_id', childDeviceId)
        .neq('is_enabled', true)
        .not('package_name', 'in', `(${Array.from(incomingPackages).map((p) => `"${p.replace(/"/g, '\\"')}"`).join(',')})`)
    } else {
      await adminClient
        .from('child_app_filters')
        .delete()
        .eq('child_device_id', childDeviceId)
        .neq('is_enabled', true)
    }

    // Record the inventory sync outcome on the pair row so the parent's wait
    // screen can advance even when the child reported zero monitorable apps.
    if (pair?.id) {
      const { error: pairUpdateError } = await adminClient
        .from('pairs')
        .update({
          child_inventory_synced_at: new Date().toISOString(),
          child_monitorable_app_count: rows.length,
        })
        .eq('id', pair.id)
      if (pairUpdateError) throw pairUpdateError
    }

    logger.info('sync-installed-apps', 'synced installed apps', { count: rows.length })

    return new Response(
      JSON.stringify({
        data: {
          synced: rows.length,
          total: rows.length,
          // "disabled_defaults" now describes how many NEW rows came in with
          // is_enabled=false (i.e. parent explicitly toggled them off). It no
          // longer reflects the default for incoming apps (mirrored by default).
          disabled_defaults: rows.filter((r) => !r.is_enabled).length,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('sync-installed-apps', safeMsg, error instanceof Error ? error.message : '')
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
