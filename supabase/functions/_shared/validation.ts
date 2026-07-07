export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function isValidUUID(val: unknown): val is string {
  return typeof val === 'string' && UUID_RE.test(val)
}

export function isValidISODate(val: unknown): val is string {
  return typeof val === 'string' && ISO_DATE_RE.test(val)
}

export function isValidString(val: unknown, maxLength = 500): val is string {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLength
}

export function sanitizeString(val: unknown, maxLength = 500): string {
  if (typeof val !== 'string') return ''
  return val.slice(0, maxLength)
}

export function requireBody(body: unknown, keys: string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Request body must be a JSON object')
  }
  const record = body as Record<string, unknown>
  for (const key of keys) {
    if (record[key] === undefined || record[key] === null) {
      throw new ValidationError(`Missing required field: ${key}`)
    }
  }
  return record
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
