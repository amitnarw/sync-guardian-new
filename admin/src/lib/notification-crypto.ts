const ENCODING_PREFIX = "nv1:";
const IV_LENGTH = 12;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getMasterKey(): Uint8Array<ArrayBuffer> {
  const raw = process.env.NOTIFICATION_ENCRYPTION_KEY;
  if (!raw) throw new Error("NOTIFICATION_ENCRYPTION_KEY environment variable not set");
  return base64ToBytes(raw);
}

async function derivePairKey(pairId: string): Promise<CryptoKey> {
  const master = getMasterKey();
  const hkdfKey = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(new ArrayBuffer(0)),
      info: new TextEncoder().encode(`notification-encryption-v1:${pairId}`),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPlaintext(plain: string, pairId: string): Promise<string> {
  if (plain.length === 0) return plain;
  const key = await derivePairKey(pairId);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_LENGTH)));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  const combined = new Uint8Array(new ArrayBuffer(IV_LENGTH + cipherBuffer.byteLength));
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), IV_LENGTH);
  return ENCODING_PREFIX + bytesToBase64(combined);
}

async function decryptToString(encoded: string, pairId: string): Promise<string> {
  if (!encoded.startsWith(ENCODING_PREFIX)) return encoded;
  try {
    const key = await derivePairKey(pairId);
    const raw = base64ToBytes(encoded.slice(ENCODING_PREFIX.length));
    const iv = raw.slice(0, IV_LENGTH);
    const cipher = raw.slice(IV_LENGTH);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    // Key mismatch or corrupted value — surface the raw ciphertext.
    return encoded;
  }
}

const CONTENT_FIELDS = [
  "notification_title",
  "notification_body",
  "source_package",
  "source_app_name",
] as const;

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(ENCODING_PREFIX);
}

export async function encryptNotification(
  row: Record<string, unknown>,
  pairId: string,
): Promise<Record<string, unknown>> {
  const out = { ...row };
  for (const field of CONTENT_FIELDS) {
    const val = out[field];
    if (typeof val === "string" && val.length > 0 && !val.startsWith(ENCODING_PREFIX)) {
      out[field] = await encryptPlaintext(val, pairId);
    }
  }
  return out;
}

export async function decryptNotification(
  row: Record<string, unknown>,
  pairId: string,
): Promise<Record<string, unknown>> {
  const out = { ...row };
  for (const field of CONTENT_FIELDS) {
    const val = out[field];
    if (isEncrypted(val)) {
      out[field] = await decryptToString(val as string, pairId);
    }
  }
  return out;
}
