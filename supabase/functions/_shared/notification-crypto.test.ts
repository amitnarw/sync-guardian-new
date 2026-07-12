// Run with: deno test --allow-env --allow-net supabase/functions/_shared/notification-crypto.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.192.0/testing/asserts.ts'
import { encryptNotification, decryptNotification } from './notification-crypto.ts'

const TEST_KEY = 'rLqFpKj2zXw8vYn5bUm3sH7dC4eA6gT9iQ0oW1nM3pB=' // base64 32-byte test key
const TEST_PAIR_ID = '00000000-0000-4000-a000-000000000001'
const WRONG_PAIR_ID = '00000000-0000-4000-a000-000000000002'

Deno.env.set('NOTIFICATION_ENCRYPTION_KEY', TEST_KEY)

Deno.test('encrypt and decrypt round-trip for all fields', async () => {
  const original = {
    notification_title: 'Hello World',
    notification_body: 'This is a test notification body',
    source_package: 'com.example.app',
    source_app_name: 'Example App',
    metadata_json: null,
  }

  const encrypted = await encryptNotification(original as unknown as Record<string, unknown>, TEST_PAIR_ID)
  for (const field of ['notification_title', 'notification_body', 'source_package', 'source_app_name'] as const) {
    const val = encrypted[field]
    assertEquals(typeof val, 'string')
    assertEquals((val as string).startsWith('nv1:'), true, `${field} should start with nv1: prefix`)
  }

  const decrypted = await decryptNotification(encrypted, TEST_PAIR_ID)
  assertEquals(decrypted.notification_title, original.notification_title)
  assertEquals(decrypted.notification_body, original.notification_body)
  assertEquals(decrypted.source_package, original.source_package)
  assertEquals(decrypted.source_app_name, original.source_app_name)
})

Deno.test('wrong pairId should return raw encrypted value (decrypt fails gracefully)', async () => {
  const original = { notification_title: 'Secret', notification_body: '', source_package: '', source_app_name: '', metadata_json: null }
  const encrypted = await encryptNotification(original as unknown as Record<string, unknown>, TEST_PAIR_ID)
  const decrypted = await decryptNotification(encrypted, WRONG_PAIR_ID)

  // decryptToString should fall back to returning the raw encrypted value
  assertEquals(decrypted.notification_title, encrypted.notification_title)
})

Deno.test('empty strings are not encrypted', async () => {
  const original = { notification_title: '', notification_body: '', source_package: null, source_app_name: undefined, metadata_json: null }
  const encrypted = await encryptNotification(original as unknown as Record<string, unknown>, TEST_PAIR_ID)
  assertEquals(encrypted.notification_title, '')
  assertEquals(encrypted.notification_body, '')
  assertEquals(encrypted.source_package, null)
  assertEquals(encrypted.source_app_name, undefined)
})

Deno.test('legacy plaintext values pass through unchanged', async () => {
  const row = { notification_title: 'plain text title', notification_body: 'plain body', source_package: 'com.test', source_app_name: 'Test', metadata_json: null }
  const decrypted = await decryptNotification(row as unknown as Record<string, unknown>, TEST_PAIR_ID)
  assertEquals(decrypted.notification_title, 'plain text title')
  assertEquals(decrypted.notification_body, 'plain body')
})

Deno.test('metadata_json object is encrypted and recovered', async () => {
  const original = { metadata_json: { key: 'value', count: 42 } }
  const encrypted = await encryptNotification(original as unknown as Record<string, unknown>, TEST_PAIR_ID)
  assertEquals((encrypted.metadata_json as string).startsWith('nv1:'), true)

  const decrypted = await decryptNotification(encrypted, TEST_PAIR_ID)
  assertEquals(decrypted.metadata_json, original.metadata_json)
})
