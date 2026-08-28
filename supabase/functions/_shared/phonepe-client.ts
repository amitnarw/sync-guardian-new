// ============================================================
// PhonePe PG V2 client (shared by subscription edge functions).
//
// Uses OAuth2 client_credentials for auth:
//   POST /v1/oauth/token  (form-urlencoded: client_id, client_version,
//                          client_secret, grant_type=client_credentials)
// Returns an access_token that must be sent as `Authorization: O-Bearer <token>`.
//
// All secrets are read from Deno.env, never hardcoded. Access tokens are
// cached in-memory per process and refreshed before expiry.
// ============================================================

import { logger } from './logger.ts'

const PHONEPE_ENV = Deno.env.get('PHONEPE_ENV') ?? 'sandbox'
const IS_SANDBOX = PHONEPE_ENV.toLowerCase() !== 'production'

const BASE_URL = IS_SANDBOX
  ? 'https://api-preprod.phonepe.com/apis/pg-sandbox'
  : 'https://api.phonepe.com/apis/pg'

const AUTH_TOKEN_URL = IS_SANDBOX
  ? `${BASE_URL}/v1/oauth/token`
  : 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'

const SDK_ORDER_URL = `${BASE_URL}/checkout/v2/sdk/order`

export type PhonePeFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'FORTNIGHTLY'
  | 'MONTHLY'
  | 'BIMONTHLY'
  | 'QUARTERLY'
  | 'HALFYEARLY'
  | 'YEARLY'
  | 'ON_DEMAND'

export interface SubscriptionOrderResult {
  orderId: string
  state: string
  token: string
  expireAt: number
}

class PhonePeApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhonePeApiError'
  }
}

// ------------------------------------------------------------------
// Access token (in-memory cache)
// ------------------------------------------------------------------
let cachedToken: string | null = null
let cachedTokenExpiresAt = 0 // epoch seconds

function getClientCredentials(): { clientId: string; clientVersion: string; clientSecret: string } {
  const clientId = Deno.env.get('PHONEPE_CLIENT_ID')
  const clientVersion = Deno.env.get('PHONEPE_CLIENT_VERSION')
  const clientSecret = Deno.env.get('PHONEPE_CLIENT_SECRET')

  if (!clientId || !clientVersion || !clientSecret) {
    throw new PhonePeApiError('PhonePe credentials are not configured on the server')
  }
  return { clientId, clientVersion, clientSecret }
}

async function fetchAccessToken(): Promise<{ token: string; expiresAt: number }> {
  const { clientId, clientVersion, clientSecret } = getClientCredentials()

  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('client_version', clientVersion)
  body.set('client_secret', clientSecret)
  body.set('grant_type', 'client_credentials')

  const res = await fetch(AUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  const raw = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(raw)
  } catch {
    throw new PhonePeApiError('Invalid auth token response from PhonePe')
  }

  if (!res.ok) {
    logger.warn('phonepe-client', 'auth token request failed', {
      status: res.status,
      code: json.code,
      message: json.message,
    })
    throw new PhonePeApiError('Unable to authenticate with PhonePe')
  }

  const token = typeof json.access_token === 'string' ? json.access_token : null
  if (!token) {
    throw new PhonePeApiError('No access token in PhonePe auth response')
  }

  const expiresAt = typeof json.expires_at === 'number'
    ? json.expires_at
    : Math.floor(Date.now() / 1000) + 3600

  return { token, expiresAt }
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  // Refresh 60s early to avoid racing expiry.
  if (cachedToken && cachedTokenExpiresAt - 60 > now) {
    return cachedToken
  }

  const { token, expiresAt } = await fetchAccessToken()
  cachedToken = token
  cachedTokenExpiresAt = expiresAt
  return token
}

// ------------------------------------------------------------------
// API helpers
// ------------------------------------------------------------------
async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const token = await getAccessToken()

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `O-Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(raw)
  } catch {
    throw new PhonePeApiError('Invalid JSON response from PhonePe')
  }

  if (!res.ok) {
    logger.warn('phonepe-client', 'request failed', {
      status: res.status,
      code: json.code,
      message: json.message,
    })
    throw new PhonePeApiError('PhonePe request failed')
  }

  return json as unknown as T
}

// ------------------------------------------------------------------
// Subscription setup (mobile SDK order)
// ------------------------------------------------------------------
export interface CreateSubscriptionOrderParams {
  merchantOrderId: string
  merchantSubscriptionId: string
  amountPaise: number
  maxAmountPaise: number
  frequency: PhonePeFrequency
  authWorkflowType?: 'TRANSACTION' | 'PENNY_DROP'
  amountType?: 'FIXED' | 'VARIABLE'
  expireAtMs?: number // subscription expiry (epoch ms)
  expireAfterSec?: number // order expiry (300..3600)
  metaInfo?: Record<string, string>
}

export async function createSubscriptionOrder(
  params: CreateSubscriptionOrderParams,
): Promise<SubscriptionOrderResult> {
  const nowMs = Date.now()
  const subscriptionDetails: Record<string, unknown> = {
    subscriptionType: 'RECURRING',
    merchantSubscriptionId: params.merchantSubscriptionId,
    authWorkflowType: params.authWorkflowType ?? 'TRANSACTION',
    amountType: params.amountType ?? 'FIXED',
    maxAmount: params.maxAmountPaise,
    frequency: params.frequency,
    productType: 'UPI_MANDATE',
  }

  if (params.expireAtMs) {
    subscriptionDetails.expireAt = params.expireAtMs
  } else {
    // Default to 1 year from now.
    subscriptionDetails.expireAt = nowMs + 365 * 24 * 60 * 60 * 1000
  }

  const payload: Record<string, unknown> = {
    merchantOrderId: params.merchantOrderId,
    amount: params.amountPaise,
    paymentFlow: {
      type: 'SUBSCRIPTION_CHECKOUT_SETUP',
      subscriptionDetails,
    },
    expireAfter: params.expireAfterSec ?? 1800,
  }

  if (params.metaInfo && Object.keys(params.metaInfo).length > 0) {
    payload.metaInfo = params.metaInfo
  }

  const res = await postJson<SubscriptionOrderResult>(SDK_ORDER_URL, payload)
  if (!res.orderId || !res.token) {
    throw new PhonePeApiError('Missing order token in PhonePe SDK order response')
  }
  return res
}

// ------------------------------------------------------------------
// Subscription status
// ------------------------------------------------------------------
export interface SubscriptionStatusResult {
  state: string
  [key: string]: unknown
}

export async function getSubscriptionStatus(
  merchantSubscriptionId: string,
): Promise<SubscriptionStatusResult> {
  const token = await getAccessToken()
  const url = `${BASE_URL}/payments/v2/subscription/${encodeURIComponent(merchantSubscriptionId)}/status`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `O-Bearer ${token}`,
    },
  })

  const raw = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(raw)
  } catch {
    throw new PhonePeApiError('Invalid JSON response from PhonePe')
  }

  if (!res.ok) {
    logger.warn('phonepe-client', 'status request failed', {
      status: res.status,
      code: json.code,
      message: json.message,
    })
    throw new PhonePeApiError('PhonePe status request failed')
  }

  return json as unknown as SubscriptionStatusResult
}

// ------------------------------------------------------------------
// Cancel subscription
// ------------------------------------------------------------------
export async function cancelPhonePeSubscription(merchantSubscriptionId: string): Promise<void> {
  const token = await getAccessToken()
  const url = `${BASE_URL}/payments/v2/subscription/${encodeURIComponent(merchantSubscriptionId)}/cancel`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `O-Bearer ${token}`,
    },
  })

  const raw = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = JSON.parse(raw)
  } catch {
    throw new PhonePeApiError('Invalid JSON response from PhonePe')
  }

  if (!res.ok) {
    logger.warn('phonepe-client', 'cancel request failed', {
      status: res.status,
      code: json.code,
      message: json.message,
    })
    throw new PhonePeApiError('PhonePe cancel request failed')
  }
}

// ------------------------------------------------------------------
// Webhook signature verification (X-VERIFY)
//
// PhonePe signs webhook payloads with the Checksum Secret Key:
//   signature = base64( HMAC-SHA256( secret, rawBody ) )
// and sends it in the `X-VERIFY` header. Verify against PHONEPE_WEBHOOK_SECRET.
//
// Security policy:
//   - Production (PHONEPE_ENV=production): secret MUST be configured.
//     A missing secret in production is treated as a 401 so a misconfigured
//     deployment cannot accidentally accept forgeries.
//   - Sandbox / local dev: secret may be missing, but ONLY when
//     ALLOW_UNVERIFIED_WEBHOOKS=true is set explicitly. This forces the
//     developer to opt in to insecure mode and surfaces the bypass in
//     infrastructure config rather than code.
// ------------------------------------------------------------------

// Constant-time string comparison. We can't trust JS's `===` to be
// constant-time across V8/SpiderMonkey implementations, and HMAC
// verification SHOULD compare signatures in constant time to avoid
// timing oracles. Both inputs must be strings of equal length for the
// comparison to be meaningful; otherwise we short-circuit on length.
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function verifyWebhookSignature(
  rawBody: string,
  xVerifyHeader: string | null,
): Promise<boolean> {
  const env = (Deno.env.get('PHONEPE_ENV') ?? 'sandbox').toLowerCase()
  const isProduction = env === 'production'
  const secret = Deno.env.get('PHONEPE_WEBHOOK_SECRET')
  const allowUnverified =
    Deno.env.get('ALLOW_UNVERIFIED_WEBHOOKS') === 'true'

  if (!secret) {
    if (isProduction) {
      logger.error(
        'phonepe-client',
        'PHONEPE_WEBHOOK_SECRET not configured in production; rejecting',
      )
      return false
    }
    if (!allowUnverified) {
      logger.error(
        'phonepe-client',
        'PHONEPE_WEBHOOK_SECRET not configured and ALLOW_UNVERIFIED_WEBHOOKS not set; rejecting',
      )
      return false
    }
    logger.warn(
      'phonepe-client',
      'PHONEPE_WEBHOOK_SECRET not configured; ALLOW_UNVERIFIED_WEBHOOKS=true set, skipping verification',
    )
    return true
  }

  if (!xVerifyHeader) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return constantTimeEqual(expected, xVerifyHeader)
}

export { PhonePeApiError, IS_SANDBOX }
