import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthenticatedUser {
  id: string
  email?: string
}

/**
 * Verify the JWT from the Authorization header.
 * Returns the authenticated user, or throws if invalid/missing.
 */
export async function verifyAuth(
  authHeader: string | null,
): Promise<AuthenticatedUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: authHeader } },
    },
  )

  const { data, error } = await supabaseClient.auth.getUser()

  if (error || !data?.user) {
    throw new Error('Unauthorized: ' + (error?.message ?? 'Invalid token'))
  }

  return {
    id: data.user.id,
    email: data.user.email,
  }
}

/**
 * In-memory rate limiter for pairing code claims.
 * Note: This is per-instance. For production across multiple instances,
 * use Redis or a DB-backed approach.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 60_000

export function checkRateLimit(key: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }

  entry.count++
  if (entry.count > MAX_ATTEMPTS) {
    throw new Error('Too many requests. Please try again in 60 seconds.')
  }
}
