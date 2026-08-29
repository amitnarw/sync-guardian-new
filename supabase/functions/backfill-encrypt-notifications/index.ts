import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import {
  decryptNotificationLegacy,
  encryptNotification,
} from '../_shared/notification-crypto.ts'
import { logger, mapError } from '../_shared/logger.ts'

const BATCH_SIZE = 100
const ENCODING_PREFIX = 'nv1:'
const ENCRYPTED_FIELDS = [
  'notification_title',
  'notification_body',
  'source_package',
  'source_app_name',
] as const

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
    let totalSkipped = 0
    let lastId: string | null = null
    let hasMore = true

    while (hasMore) {
      let query = adminClient
        .from('mirrored_notifications')
        .select('id, parent_user_id, child_user_id, pair_id')
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

      const updatedRows = await Promise.all(
        rows.map(async (meta: Record<string, unknown>) => {
          const id = meta.id as string
          const parentUserId = meta.parent_user_id as string
          const childUserId = meta.child_user_id as string
          const pairId = meta.pair_id as string | null

          if (!parentUserId || !childUserId) {
            logger.warn('backfill', 'skip row missing relationship columns', { id })
            return null
          }

          const { data: fullRow, error: fetchError } = await adminClient
            .from('mirrored_notifications')
            .select('*')
            .eq('id', id)
            .maybeSingle()
          if (fetchError || !fullRow) {
            logger.warn('backfill', 'failed to load full row', { id, error: fetchError?.message })
            return null
          }

          const row = fullRow as Record<string, unknown>

          const plaintextRow = pairId
            ? await decryptNotificationLegacy(row, pairId)
            : row

          // Corruption guard: if any previously-encrypted field still
          // starts with `nv1:` after legacy decryption, the decrypt
          // failed silently (likely wrong key). Skip the row instead
          // of re-encrypting ciphertext as if it were plaintext.
          let decryptionFailed = false
          for (const field of ENCRYPTED_FIELDS) {
            const original = row[field]
            const decrypted = plaintextRow[field]
            if (
              typeof original === 'string' &&
              original.startsWith(ENCODING_PREFIX) &&
              typeof decrypted === 'string' &&
              decrypted.startsWith(ENCODING_PREFIX)
            ) {
              decryptionFailed = true
              break
            }
          }
          if (decryptionFailed) {
            logger.warn('backfill', 'skip row: legacy decryption returned ciphertext', { id })
            return null
          }

          return await encryptNotification(
            plaintextRow,
            parentUserId,
            childUserId,
          )
        }),
      )

      const validRows = updatedRows.filter((r): r is Record<string, unknown> => r !== null)
      totalSkipped += rows.length - validRows.length

      if (validRows.length > 0) {
        const { error: updateError } = await adminClient
          .from('mirrored_notifications')
          .upsert(validRows, { onConflict: 'id' })

        if (updateError) throw updateError
      }

      totalProcessed += validRows.length
      lastId = rows[rows.length - 1].id as string

      if (rows.length < BATCH_SIZE) {
        hasMore = false
      }
    }

    logger.info('backfill-encrypt-notifications', 'completed', { totalProcessed, totalSkipped })
    return new Response(
      JSON.stringify({ data: { processed: totalProcessed, skipped: totalSkipped } }),
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
