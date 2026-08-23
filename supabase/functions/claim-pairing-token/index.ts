import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth, checkRateLimit } from '../_shared/auth-verifier.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'
import { verifyQrJwt } from '../_shared/qr-jwt.ts'
import { upsertOnboardingState } from '../_shared/onboarding-state.ts'
import { logger, mapError } from '../_shared/logger.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const adminClient = getAdminClient()
    const body = await req.json()

    checkRateLimit(req.headers.get('x-forwarded-for') ?? user.id)

    let token: string | null = body.token || null
    let code: string | null = body.code || null

    if (body.qr_jwt) {
      const result = await verifyQrJwt(body.qr_jwt)
      if (!result.ok) {
        logger.warn('claim-pairing-token', 'QR JWT verification failed', { reason: result.reason })
        const message =
          result.reason === 'expired'
            ? 'This QR code has expired. Ask the child to tap Regenerate and scan the new code.'
            : result.reason === 'bad_signature'
              ? 'QR code signature is invalid. The pairing secret may be misconfigured.'
              : 'This QR code is not valid. Ask the child to tap Regenerate and scan the new code.'
        return new Response(
          JSON.stringify({ error: message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }
      token = result.payload.token
      code = result.payload.code
    }

    if (!token && !code) {
      return new Response(
        JSON.stringify({ error: 'token, code, or qr_jwt is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const { data, error } = await adminClient.rpc('claim_pairing_token', {
      p_token: token || null,
      p_code: code || null,
      p_parent_user_id: user.id,
    })

    if (error) throw new Error(error.message)

    // Advance onboarding for both users. A transient failure here would leave
    // the rows stuck at a pre-pairing step while the pair is already active —
    // which used to funnel paired users back into /pairing on every launch —
    // so retry a few times and escalate to error logging if all attempts fail.
    const upsertOnboardingWithRetry = async (
      userId: string,
      updates: Parameters<typeof upsertOnboardingState>[1],
      attempts = 3,
    ): Promise<void> => {
      let lastErr: unknown
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          await upsertOnboardingState(userId, updates)
          return
        } catch (err) {
          lastErr = err
          if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, 150 * attempt))
          }
        }
      }
      throw lastErr
    }

    try {
      const pair = data as any
      await upsertOnboardingWithRetry(user.id, {
        selected_role: 'parent',
        onboarding_step: 'app_selection',
      })
      if (pair?.child_user_id) {
        await upsertOnboardingWithRetry(pair.child_user_id, {
          onboarding_step: 'app_selection',
        })
      }
    } catch (obErr) {
      logger.error('claim-pairing-token', 'onboarding upsert failed after retries', obErr instanceof Error ? obErr.message : String(obErr))
    }

    try {
      const pair = data as any
      if (pair?.id) {
        const { data: pairRow, error: pairErr } = await adminClient
          .from('pairs')
          .select('child_device_id, parent_setup_completed')
          .eq('id', pair.id)
          .single()
        if (!pairErr && pairRow && !pairRow.parent_setup_completed) {
          const { data: parentDev } = await adminClient
            .from('devices')
            .select('push_token')
            .eq('id', pair.parent_device_id)
            .single()
          const { data: childProfile } = await adminClient
            .from('profiles')
            .select('display_name')
            .eq('id', pairRow.child_user_id)
            .single()
          const childName = (childProfile as any)?.display_name || 'Your child'
          const parentToken = (parentDev as any)?.push_token
          if (parentToken) {
            const { sendParentPush } = await import('../_shared/fcm.ts')
            await sendParentPush(
              parentToken,
              `${childName}'s device is ready`,
              'Open Sync Guardian to choose which apps to monitor.',
            )
          }
        }
      }
    } catch (pushErr) {
      logger.warn('claim-pairing-token', 'setup reminder push failed', { error: String(pushErr) })
    }

    return new Response(
      JSON.stringify({ data: { ...data, parent_device_id: data?.parent_device_id || 'unknown' } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    try {
      const msg = error instanceof Error ? error.message : ''
      const lower = msg.toLowerCase()
      if (lower.includes('expired') || (lower.includes('invalid') && lower.includes('pair'))) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired pairing code.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
      }
      const { status, error: safeMsg } = mapError(error)
      logger.error('claim-pairing-token', safeMsg, msg)
      return new Response(
        JSON.stringify({ error: safeMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
      )
    } catch (secondary) {
      const fallbackMsg = secondary instanceof Error ? secondary.message : 'Unknown error in error handler'
      logger.error('claim-pairing-token', 'exception in error handler', fallbackMsg)
      return new Response(
        JSON.stringify({ error: 'An unexpected error occurred.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }
  }
})
