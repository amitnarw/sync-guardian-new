import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { verifyAuth } from '../_shared/auth-verifier.ts'
import { upsertOnboardingState, type OnboardingRole, type OnboardingStep } from '../_shared/onboarding-state.ts'
import { isValidString } from '../_shared/validation.ts'
import { logger, mapError } from '../_shared/logger.ts'

const VALID_ROLES: OnboardingRole[] = ['parent', 'child', 'admin']

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const authHeader = req.headers.get('Authorization')
    const user = await verifyAuth(authHeader)

    const body = await req.json()
    const selected_role = isValidString(body.selected_role, 20) ? body.selected_role : null
    const onboarding_step = isValidString(body.onboarding_step, 30) ? body.onboarding_step : null

    if (!selected_role || !VALID_ROLES.includes(selected_role as OnboardingRole)) {
      return new Response(
        JSON.stringify({ error: 'selected_role must be parent, child, or admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    await upsertOnboardingState(user.id, {
      selected_role: selected_role as OnboardingRole,
      ...(onboarding_step
        ? { onboarding_step: onboarding_step as OnboardingStep }
        : {}),
    })

    return new Response(
      JSON.stringify({ data: { ok: true } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    const { status, error: safeMsg } = mapError(error)
    logger.error('set-onboarding-role', safeMsg, error instanceof Error ? error.message : '')
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status },
    )
  }
})
