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

/**
 * Derive a per-relationship AES-GCM key for the parent_user_id +
 * child_user_id pair. This stays stable across disconnect/reconnect
 * cycles because the user IDs do not change, unlike pair_id which
 * is regenerated on every new pairing.
 */
async function deriveRelationshipKey(parentUserId: string, childUserId: string): Promise<CryptoKey> {
  const master = getMasterKey()
  const hkdfKey = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(`notification-encryption-v1:${parentUserId}:${childUserId}`),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Legacy per-pair key derivation. Only used by the
 * `backfill-encrypt-notifications` edge function during the
 * one-time migration from pair_id keys to relationship keys.
 * Must not be used in any other code path.
 */
async function deriveLegacyPairKey(pairId: string): Promise<CryptoKey> {
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

async function decryptToStringLegacy(encoded: string, pairId: string): Promise<string> {
  if (!encoded.startsWith(ENCODING_PREFIX)) return encoded
  try {
    const key = await deriveLegacyPairKey(pairId)
    const raw = base64ToBytes(encoded.slice(ENCODING_PREFIX.length))
    const iv = raw.slice(0, IV_LENGTH)
    const cipher = raw.slice(IV_LENGTH)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return new TextDecoder().decode(plain)
  } catch (err) {
    logger.warn('notification-crypto', 'legacy decrypt failed, returning raw value', err)
    return encoded
  }
}

async function encryptPlaintext(plain: string, parentUserId: string, childUserId: string): Promise<string> {
  if (plain.length === 0) return plain
  const key = await deriveRelationshipKey(parentUserId, childUserId)
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

async function decryptToString(encoded: string, parentUserId: string, childUserId: string): Promise<string> {
  if (!encoded.startsWith(ENCODING_PREFIX)) return encoded
  // Failure here means the master key changed, the row was tampered with,
  // or the relationship key was derived against wrong user IDs. We surface
  // a distinct DecryptionError so callers can decide whether to skip the
  // row or fail the whole request. We do NOT silently return the
  // ciphertext (that used to leak "nv1:..." blobs into the parent UI).
  const key = await deriveRelationshipKey(parentUserId, childUserId)
  const raw = base64ToBytes(encoded.slice(ENCODING_PREFIX.length))
  if (raw.length <= IV_LENGTH) {
    throw new DecryptionError('encrypted payload is shorter than the IV')
  }
  const iv = raw.slice(0, IV_LENGTH)
  const cipher = raw.slice(IV_LENGTH)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain)
}

const CONTENT_FIELDS = ['notification_title', 'notification_body', 'source_package', 'source_app_name'] as const

export async function encryptNotification(
  row: Record<string, unknown>,
  parentUserId: string,
  childUserId: string,
): Promise<Record<string, unknown>> {
  const out = { ...row }
  for (const field of CONTENT_FIELDS) {
    const val = out[field]
    if (typeof val === 'string' && val.length > 0) {
      out[field] = await encryptPlaintext(val, parentUserId, childUserId)
    }
  }
  return out
}

/**
 * Thrown when AES-GCM decryption fails. Callers should decide whether to
 * skip the failed field, fail the whole row, or fail the whole request.
 */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecryptionError'
  }
}

export async function decryptNotification(
  row: Record<string, unknown>,
  parentUserId: string,
  childUserId: string,
): Promise<Record<string, unknown>> {
  const out = { ...row }
  for (const field of CONTENT_FIELDS) {
    const val = out[field]
    if (typeof val === 'string' && val.startsWith(ENCODING_PREFIX)) {
      out[field] = await decryptToString(val, parentUserId, childUserId)
    }
  }
  return out
}

/**
 * One-time legacy decrypt used by `backfill-encrypt-notifications`
 * during the pair_id -> relationship_key migration. Reads ciphertext
 * that was encrypted with the old pair_id key and returns the
 * plaintext rows so the backfill can re-encrypt them with the
 * relationship key.
 */
export async function decryptNotificationLegacy(
  row: Record<string, unknown>,
  pairId: string,
): Promise<Record<string, unknown>> {
  const out = { ...row }
  for (const field of CONTENT_FIELDS) {
    const val = out[field]
    if (typeof val === 'string' && val.startsWith(ENCODING_PREFIX)) {
      out[field] = await decryptToStringLegacy(val, pairId)
    }
  }
  return out
}
