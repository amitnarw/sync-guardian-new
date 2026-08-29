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

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getFcmAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token
  }

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

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text()
    throw new Error(`FCM OAuth token request failed (${tokenResponse.status}): ${body}`)
  }

  const tokenData = await tokenResponse.json()
  if (!tokenData.access_token) {
    throw new Error(`Failed to get FCM OAuth token: ${JSON.stringify(tokenData)}`)
  }

  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in ? tokenData.expires_in * 1000 : 3600000) - 60000,
  }

  return tokenData.access_token
}

export interface ParentPushResult {
  success: boolean
  messageId?: string
  unregisteredToken?: boolean
}

export async function sendParentPush(
  deviceToken: string,
  title: string,
  body: string,
  notificationCount?: number,
): Promise<ParentPushResult> {
  const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountRaw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured')
  }

  const serviceAccount: Record<string, string> = JSON.parse(serviceAccountRaw)
  const accessToken = await getFcmAccessToken(serviceAccount)

  const safeTitle = (title || 'Sync Guardian').slice(0, 100)
  const messageBody: string = notificationCount && notificationCount > 1
    ? `${notificationCount} new notifications`
    : (body || 'New notification').slice(0, 200)

  const fcmPayload = {
    message: {
      token: deviceToken,
      notification: {
        title: safeTitle,
        body: messageBody,
      },
      android: {
        priority: 'high' as const,
        notification: {
          channel_id: 'sync_guardian_alerts',
          priority: 'high' as const,
          default_sound: true,
        },
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
    const errorCode = fcmData?.error?.details?.[0]?.errorCode
    // Only treat these two error codes as terminal token state. Everything
    // else (INVALID_ARGUMENT for malformed payloads, QUOTA_EXCEEDED,
    // UNAVAILABLE, INTERNAL, etc.) is transient or payload-side and must
    // NOT wipe a valid push token.
    if (errorCode === 'UNREGISTERED' || errorCode === 'SENDER_ID_MISMATCH') {
      return { success: false, unregisteredToken: true }
    }
    throw new Error(`FCM error: ${JSON.stringify(fcmData)}`)
  }

  return { success: true, messageId: fcmData.name }
}

export async function sendChildRecoveryPush(
  pushToken: string,
): Promise<ParentPushResult> {
  const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountRaw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured')
  }

  const serviceAccount: Record<string, string> = JSON.parse(serviceAccountRaw)
  const accessToken = await getFcmAccessToken(serviceAccount)

  const fcmPayload = {
    message: {
      token: pushToken,
      data: {
        type: 'wake_child_notification_listener',
        timestamp: String(Date.now()),
      },
      android: {
        priority: 'high' as const,
        ttl: '3600s',
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
    const errorCode = fcmData?.error?.details?.[0]?.errorCode
    if (errorCode === 'UNREGISTERED' || errorCode === 'SENDER_ID_MISMATCH') {
      return { success: false, unregisteredToken: true }
    }
    throw new Error(`FCM error: ${JSON.stringify(fcmData)}`)
  }

  return { success: true, messageId: fcmData.name }
}

export async function sendPairRevokedPush(
  deviceToken: string,
  revokedBy: 'parent' | 'child',
  pairId?: string,
): Promise<ParentPushResult> {
  const serviceAccountRaw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountRaw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not configured')
  }

  const serviceAccount: Record<string, string> = JSON.parse(serviceAccountRaw)
  const accessToken = await getFcmAccessToken(serviceAccount)

  const fcmPayload = {
    message: {
      token: deviceToken,
      data: {
        type: 'pair_revoked',
        revoked_by: revokedBy,
        pair_id: pairId || '',
        timestamp: String(Date.now()),
      },
      android: {
        priority: 'high' as const,
        ttl: '0s',
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
    const errorCode = fcmData?.error?.details?.[0]?.errorCode
    if (errorCode === 'UNREGISTERED' || errorCode === 'SENDER_ID_MISMATCH') {
      return { success: false, unregisteredToken: true }
    }
    throw new Error(`FCM error: ${JSON.stringify(fcmData)}`)
  }

  return { success: true, messageId: fcmData.name }
}
