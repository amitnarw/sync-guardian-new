// Lightweight logger + error sanitizer for Deno edge functions.
// Aligns with AGENTS.md guidance to avoid leaking internal details in responses.

type LogLevel = 'info' | 'warn' | 'error'

// Strip UUIDs and token-like strings from logs so sensitive identifiers
// never reach log sinks (see AGENTS.md: "Never expose real UUIDs or tokens").
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const TOKEN_RE = /(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)|(AIza[0-9A-Za-z_-]{10,})/g
// Opaque tokens (FCM device tokens, etc.) are long base64url/hex strings.
const OPAQUE_TOKEN_RE = /[A-Za-z0-9_-]{40,}/g
// Keys whose values should be fully redacted regardless of shape.
const SENSITIVE_KEY_RE = /(token|secret|password|api[_-]?key|private[_-]?key|service[_-]?account|authorization|auth|access[_-]?token|firebase)/i

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveKeys)
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k) && typeof v === 'string') {
        out[k] = '[redacted]'
      } else {
        out[k] = redactSensitiveKeys(v)
      }
    }
    return out
  }
  return value
}

function stripTokens(text: string): string {
  return text
    .replace(UUID_RE, '[uuid]')
    .replace(TOKEN_RE, '[token]')
    .replace(OPAQUE_TOKEN_RE, '[token]')
}

export function sanitizeLogMeta(meta: unknown): unknown {
  if (typeof meta === 'string') {
    return stripTokens(meta)
  }
  if (meta && typeof meta === 'object') {
    try {
      const redacted = redactSensitiveKeys(meta)
      return stripTokens(JSON.stringify(redacted))
    } catch {
      return meta
    }
  }
  return meta
}

function emit(level: LogLevel, scope: string, msg: string, meta?: unknown) {
  const prefix = `[SG:${scope}]`
  const safeMeta = meta !== undefined ? sanitizeLogMeta(meta) : ''
  if (level === 'info') console.log(prefix, msg, safeMeta)
  else if (level === 'warn') console.warn(prefix, msg, safeMeta)
  else console.error(prefix, msg, safeMeta)
}

export const logger = {
  info: (scope: string, msg: string, meta?: unknown) => emit('info', scope, msg, meta),
  warn: (scope: string, msg: string, meta?: unknown) => emit('warn', scope, msg, meta),
  error: (scope: string, msg: string, meta?: unknown) => emit('error', scope, msg, meta),
}

export interface ErrorResponse {
  status: number
  error: string
}

/**
 * Maps an arbitrary thrown error to a safe HTTP status + user-facing message.
 * Internal details (env var names, Postgrest SQL errors) are never exposed.
 */
export function mapError(error: unknown): ErrorResponse {
  const msg = error instanceof Error ? error.message : 'Unknown error'

  if (error instanceof AuthError) {
    return { status: 401, error: 'Session expired or invalid. Please sign in again.' }
  }
  if (error instanceof ValidationError) {
    return { status: 400, error: 'Invalid request.' }
  }

  const name = error instanceof Error ? error.name : ''

  // Supabase PostgrestError exposes `.code` (SQLSTATE).
  const code = (error as any)?.code as string | undefined

  if (name === 'TooManyRequestsError' || msg.includes('Too many')) {
    return { status: 429, error: 'Too many attempts. Please try again later.' }
  }
  if (code === '42501' /* insufficient_privilege / RLS */ || (name === 'PostgrestError' && !code)) {
    return { status: 403, error: 'You are not authorized to perform this action.' }
  }
  if (code?.startsWith('23')) {
    // Class 23 = integrity constraint violation (e.g. 23505 unique, 23503 FK)
    return { status: 400, error: 'The request could not be processed due to a data conflict.' }
  }
  if (name === 'PostgrestError') {
    return { status: 400, error: 'The request could not be completed.' }
  }

  // Catch-all: never leak raw server internals like missing env vars or FCM details.
  return { status: 400, error: 'Something went wrong. Please try again.' }
}

// Re-export so auth-verifier's AuthError and validation's ValidationError are
// recognised by mapError without extra imports in callers.
export { AuthError } from './auth-verifier.ts'
export { ValidationError } from './validation.ts'
