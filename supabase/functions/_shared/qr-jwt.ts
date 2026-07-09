function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function getSecret(): string {
  const secret = Deno.env.get('QR_JWT_SECRET')
  if (!secret) throw new Error('QR_JWT_SECRET not configured')
  return secret
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export interface QrJwtPayload {
  token: string
  code: string
  child_device_id: string
  exp: number
}

export async function signQrJwt(payload: QrJwtPayload): Promise<string> {
  const secret = getSecret()
  const key = await getHmacKey(secret)
  const encoder = new TextEncoder()

  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)))
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)))

  const signatureInput = `${headerB64}.${payloadB64}`
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput))
  const signatureB64 = base64url(new Uint8Array(signature))

  return `${signatureInput}.${signatureB64}`
}

export type QrJwtVerifyResult =
  | { ok: true; payload: QrJwtPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'decode_error' }

export async function verifyQrJwt(jwt: string): Promise<QrJwtVerifyResult> {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3 || parts.some((p) => !p)) {
      return { ok: false, reason: 'malformed' }
    }

    const secret = getSecret()
    const key = await getHmacKey(secret)
    const encoder = new TextEncoder()

    const signatureInput = `${parts[0]}.${parts[1]}`
    const signatureToVerify = base64urlDecode(parts[2])

    const valid = await crypto.subtle.verify('HMAC', key, signatureToVerify, encoder.encode(signatureInput))
    if (!valid) return { ok: false, reason: 'bad_signature' }

    const payload: QrJwtPayload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1])))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { ok: false, reason: 'expired' }
    }

    return { ok: true, payload }
  } catch {
    return { ok: false, reason: 'decode_error' }
  }
}
