import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { encryptNotification } from '../_shared/notification-crypto.ts'
import { logger, mapError } from '../_shared/logger.ts'

const BATCH_SIZE = 100

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const apiKey = Deno.env.get('BACKFILL_API_KEY')
    const headerKey = req.headers.get('x-api-key')
    if (!apiKey || headerKey !== apiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const adminClient = getAdminClient()
    let totalProcessed = 0
    let lastId: string | null = null
    let hasMore = true

    while (hasMore) {
      let query = adminClient
        .from('mirrored_notifications')
        .select('*')
        .not('notification_title', 'like', 'nv1:%')
        .order('id', { ascending: true })
        .limit(BATCH_SIZE)

      if (lastId) {
        query = query.gt('id', lastId)
      }

      const { data: rows, error } = await query
      if (error) throw error

      if (!rows || rows.length === 0) {
        hasMore = false
        break
      }

      const encryptedRows = await Promise.all(
        rows.map((r: Record<string, unknown>) => encryptNotification(r, r.pair_id as string)),
      )

      const { error: updateError } = await adminClient
        .from('mirrored_notifications')
        .upsert(encryptedRows, { onConflict: 'id' })

      if (updateError) throw updateError

      totalProcessed += rows.length
      lastId = rows[rows.length - 1].id as string

      if (rows.length < BATCH_SIZE) {
        hasMore = false
      }
    }

    logger.info('backfill-encrypt-notifications', 'completed', { totalProcessed })
    return new Response(
      JSON.stringify({ data: { processed: totalProcessed } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('backfill-encrypt-notifications', safeMsg, error instanceof Error ? error.message : error)
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
