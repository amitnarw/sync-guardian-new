// Run with: deno test --allow-env --allow-net supabase/functions/_shared/notification-crypto.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.192.0/testing/asserts.ts'
import { encryptNotification, decryptNotification, DecryptionError } from './notification-crypto.ts'

const TEST_KEY = 'rLqFpKj2zXw8vYn5bUm3sH7dC4eA6gT9iQ0oW1nM3pB=' // base64 32-byte test key
const TEST_PARENT_USER_ID = '00000000-0000-4000-a000-000000000001'
const TEST_CHILD_USER_ID = '00000000-0000-4000-a000-000000000002'
const WRONG_CHILD_USER_ID = '00000000-0000-4000-a000-000000000003'

Deno.env.set('NOTIFICATION_ENCRYPTION_KEY', TEST_KEY)

Deno.test('encrypt and decrypt round-trip for all fields', async () => {
  const original = {
    notification_title: 'Hello World',
    notification_body: 'This is a test notification body',
    source_package: 'com.example.app',
    source_app_name: 'Example App',
  }

  const encrypted = await encryptNotification(
    original as unknown as Record<string, unknown>,
    TEST_PARENT_USER_ID,
    TEST_CHILD_USER_ID,
  )
  for (const field of ['notification_title', 'notification_body', 'source_package', 'source_app_name'] as const) {
    const val = encrypted[field]
    assertEquals(typeof val, 'string')
    assertEquals((val as string).startsWith('nv1:'), true, `${field} should start with nv1: prefix`)
  }

  const decrypted = await decryptNotification(
    encrypted,
    TEST_PARENT_USER_ID,
    TEST_CHILD_USER_ID,
  )
  assertEquals(decrypted.notification_title, original.notification_title)
  assertEquals(decrypted.notification_body, original.notification_body)
  assertEquals(decrypted.source_package, original.source_package)
  assertEquals(decrypted.source_app_name, original.source_app_name)
})

Deno.test('wrong childUserId throws DecryptionError (no silent leak of nv1: blob)', async () => {
  const original = {
    notification_title: 'Secret',
    notification_body: '',
    source_package: '',
    source_app_name: '',
  }
  const encrypted = await encryptNotification(
    original as unknown as Record<string, unknown>,
    TEST_PARENT_USER_ID,
    TEST_CHILD_USER_ID,
  )

  // The mobile + admin paths must surface a DecryptionError instead of
  // silently returning the raw "nv1:" blob to the parent UI. Callers
  // (get-notifications, dashboard) catch this and skip the row.
  await assertRejects(
    () =>
      decryptNotification(
        encrypted,
        TEST_PARENT_USER_ID,
        WRONG_CHILD_USER_ID,
      ),
    DecryptionError,
  )
})

Deno.test('empty strings are not encrypted', async () => {
  const original = {
    notification_title: '',
    notification_body: '',
    source_package: null,
    source_app_name: undefined,
  }
  const encrypted = await encryptNotification(
    original as unknown as Record<string, unknown>,
    TEST_PARENT_USER_ID,
    TEST_CHILD_USER_ID,
  )
  assertEquals(encrypted.notification_title, '')
  assertEquals(encrypted.notification_body, '')
  assertEquals(encrypted.source_package, null)
  assertEquals(encrypted.source_app_name, undefined)
})

Deno.test('legacy plaintext values pass through unchanged', async () => {
  const row = {
    notification_title: 'plain text title',
    notification_body: 'plain body',
    source_package: 'com.test',
    source_app_name: 'Test',
  }
  const decrypted = await decryptNotification(
    row as unknown as Record<string, unknown>,
    TEST_PARENT_USER_ID,
    TEST_CHILD_USER_ID,
  )
  assertEquals(decrypted.notification_title, 'plain text title')
  assertEquals(decrypted.notification_body, 'plain body')
})

Deno.test('ciphertext shorter than IV throws DecryptionError', async () => {
  // Construct a payload that starts with the prefix but is too short to be a
  // valid IV (12 bytes) + ciphertext.
  const shortRow = {
    notification_title: 'nv1:abcd',
    notification_body: '',
    source_package: '',
    source_app_name: '',
  }
  await assertRejects(
    () =>
      decryptNotification(
        shortRow as unknown as Record<string, unknown>,
        TEST_PARENT_USER_ID,
        TEST_CHILD_USER_ID,
      ),
    DecryptionError,
  )
})
