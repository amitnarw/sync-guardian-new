import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { getAdminClient } from '../_shared/supabase-admin.ts'

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function pemToBinary(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN .*?-----/, '')
    .replace(/-----END .*?-----/, '')
    .replace(/\s/g, '')
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const { client_email, private_key } = serviceAccount
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'RS256', typ: 'JWT' }
  const jwtPayload = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const encoder = new TextEncoder()
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)))
  const payloadB64 = base64url(encoder.encode(JSON.stringify(jwtPayload)))
  const signatureInput = `${headerB64}.${payloadB64}`

  const keyData = pemToBinary(private_key)
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    encoder.encode(signatureInput),
  )

  const signatureB64 = base64url(new Uint8Array(signature))
  const jwt = `${signatureInput}.${signatureB64}`

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get OAuth token: ${JSON.stringify(tokenData)}`)
  }
  return tokenData.access_token
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Verify caller has the service_role key (internal function only)
    const authHeader = req.headers.get('Authorization') ?? ''
    const expectedKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== expectedKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 },
      )
    }

    const adminClient = getAdminClient()
    const { child_device_id } = await req.json()
    if (!child_device_id) {
      return new Response(
        JSON.stringify({ error: 'child_device_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const { data: childDevice, error: deviceError } = await adminClient
      .from('devices')
      .select('push_token')
      .eq('id', child_device_id)
      .single()

    if (deviceError || !childDevice?.push_token) {
      return new Response(
        JSON.stringify({ error: 'Child device not found or has no push token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      )
    }

    const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountRaw) {
      return new Response(
        JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const serviceAccount = JSON.parse(serviceAccountRaw)
    const accessToken = await getAccessToken(serviceAccount)

    // High-priority data message. Omit notification block to avoid blank notification on some OEMs.
    const fcmPayload = {
      message: {
        token: childDevice.push_token,
        data: {
          type: 'wake_child_notification_listener',
          timestamp: String(Date.now()),
        },
        android: {
          priority: 'high' as const,
        },
      },
    }

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`
    const fcmResponse = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmPayload),
    })

    const fcmData = await fcmResponse.json()

    if (!fcmResponse.ok) {
      throw new Error(`FCM error: ${JSON.stringify(fcmData)}`)
    }

    return new Response(
      JSON.stringify({ success: true, messageId: fcmData.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
