import { logger } from './logger.ts'

const ENCODING_PREFIX = 'nv1:'
const IV_LENGTH = 12

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function getMasterKey(): Uint8Array {
  const raw = Deno.env.get('NOTIFICATION_ENCRYPTION_KEY')
  if (!raw) throw new Error('NOTIFICATION_ENCRYPTION_KEY environment variable not set')
  return base64ToBytes(raw)
}

async function derivePairKey(pairId: string): Promise<CryptoKey> {
  const master = getMasterKey()
  const hkdfKey = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(`notification-encryption-v1:${pairId}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptPlaintext(plain: string, pairId: string): Promise<string> {
  if (plain.length === 0) return plain
  const key = await derivePairKey(pairId)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain),
  )
  const combined = new Uint8Array(IV_LENGTH + cipherBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuffer), IV_LENGTH)
  return ENCODING_PREFIX + bytesToBase64(combined)
}

async function decryptToString(encoded: string, pairId: string): Promise<string> {
  if (!encoded.startsWith(ENCODING_PREFIX)) return encoded
  try {
    const key = await derivePairKey(pairId)
    const raw = base64ToBytes(encoded.slice(ENCODING_PREFIX.length))
    const iv = raw.slice(0, IV_LENGTH)
    const cipher = raw.slice(IV_LENGTH)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return new TextDecoder().decode(plain)
  } catch (err) {
    logger.warn('notification-crypto', 'decrypt failed, returning raw value', err)
    return encoded
  }
}

const CONTENT_FIELDS = ['notification_title', 'notification_body', 'source_package', 'source_app_name', 'metadata_json'] as const

export async function encryptNotification(row: Record<string, unknown>, pairId: string): Promise<Record<string, unknown>> {
  const out = { ...row }
  for (const field of CONTENT_FIELDS) {
    let val = out[field]
    if (val === null || val === undefined) continue
    if (field === 'metadata_json' && typeof val === 'object') {
      val = JSON.stringify(val)
    }
    if (typeof val === 'string' && val.length > 0) {
      out[field] = await encryptPlaintext(val, pairId)
    }
  }
  return out
}

export async function decryptNotification(row: Record<string, unknown>, pairId: string): Promise<Record<string, unknown>> {
  const out = { ...row }
  for (const field of CONTENT_FIELDS) {
    const val = out[field]
    if (typeof val === 'string' && val.startsWith(ENCODING_PREFIX)) {
      const decrypted = await decryptToString(val, pairId)
      if (field === 'metadata_json') {
        try {
          out[field] = JSON.parse(decrypted)
        } catch {
          out[field] = decrypted
        }
      } else {
        out[field] = decrypted
      }
    }
  }
  return out
}
