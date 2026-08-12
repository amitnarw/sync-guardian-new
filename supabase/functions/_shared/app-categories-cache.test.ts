// Run with: deno test --allow-env --allow-net supabase/functions/_shared/app-categories-cache.test.ts
import {
  assert,
  assertEquals,
} from 'https://deno.land/std@0.192.0/testing/asserts.ts'
import {
  getEnabledAppCategories,
  isSocialMediaPackage,
  _resetCacheForTests,
} from './app-categories-cache.ts'

interface AdminClient {
  callCount: number
  rows: Array<{ package_name: string; category: string }>
}

function makeAdmin(rows: Array<{ package_name: string; category: string }>): {
  client: any
  state: AdminClient
} {
  const state: AdminClient = { callCount: 0, rows }
  const client = {
    from(table: string) {
      assertEquals(table, 'app_categories')
      return {
        select(cols: string) {
          assertEquals(cols, 'package_name, category')
          return {
            async eq(col: string, val: unknown) {
              state.callCount += 1
              assertEquals(col, 'enabled')
              assertEquals(val, true)
              return { data: state.rows }
            },
          }
        },
      }
    },
  }
  return { client, state }
}

Deno.test('cache: fetches on first call', async () => {
  _resetCacheForTests()
  const { client, state } = makeAdmin([
    { package_name: 'com.whatsapp', category: 'messaging' },
    { package_name: 'com.instagram.android', category: 'social' },
  ])

  const { packages, categories } = await getEnabledAppCategories(client)
  assertEquals(state.callCount, 1)
  assertEquals(packages.size, 2)
  assert(packages.has('com.whatsapp'))
  assert(packages.has('com.instagram.android'))
  assertEquals(categories.get('com.whatsapp'), 'messaging')
  assertEquals(categories.get('com.instagram.android'), 'social')
})

Deno.test('cache: second call within TTL reuses cached data', async () => {
  _resetCacheForTests()
  const { client, state } = makeAdmin([
    { package_name: 'com.whatsapp', category: 'messaging' },
  ])

  const a = await getEnabledAppCategories(client)
  const b = await getEnabledAppCategories(client)
  assertEquals(state.callCount, 1)
  assertEquals(a.packages, b.packages)
})

Deno.test('cache: re-fetches after reset', async () => {
  _resetCacheForTests()
  const { client, state } = makeAdmin([
    { package_name: 'com.whatsapp', category: 'messaging' },
  ])

  await getEnabledAppCategories(client)
  assertEquals(state.callCount, 1)
  _resetCacheForTests()
  await getEnabledAppCategories(client)
  assertEquals(state.callCount, 2)
})

Deno.test('cache: well-known packages are present (regression guard)', async () => {
  _resetCacheForTests()
  const canonical = [
    { package_name: 'com.instagram.android', category: 'social' },
    { package_name: 'com.facebook.katana', category: 'social' },
    { package_name: 'com.facebook.orca', category: 'messaging' },
    { package_name: 'com.zhiliaoapp.musically', category: 'social' },
    { package_name: 'com.snapchat.android', category: 'social' },
    { package_name: 'com.reddit.frontpage', category: 'social' },
    { package_name: 'com.linkedin.android', category: 'social' },
    { package_name: 'com.pinterest', category: 'social' },
    { package_name: 'com.tumblr', category: 'social' },
    { package_name: 'com.discord', category: 'messaging' },
    { package_name: 'com.twitter.android', category: 'social' },
    { package_name: 'com.whatsapp', category: 'messaging' },
    { package_name: 'org.telegram.messenger', category: 'messaging' },
    { package_name: 'com.signal.android', category: 'messaging' },
    { package_name: 'com.viber.voip', category: 'messaging' },
    { package_name: 'com.tencent.mm', category: 'messaging' },
    { package_name: 'jp.naver.line.android', category: 'messaging' },
    { package_name: 'com.kakao.talk', category: 'messaging' },
    { package_name: 'com.skype.raider', category: 'messaging' },
    { package_name: 'com.imo.android.imoim', category: 'messaging' },
    { package_name: 'com.tinder', category: 'dating' },
    { package_name: 'com.bumble.app', category: 'dating' },
    { package_name: 'com.hinge.app', category: 'dating' },
  ]
  const { client } = makeAdmin(canonical)
  const { packages } = await getEnabledAppCategories(client)
  for (const row of canonical) {
    assert(packages.has(row.package_name), `expected ${row.package_name} to be in the seeded list`)
  }
})

Deno.test('cache: isSocialMediaPackage uses cached Set', async () => {
  _resetCacheForTests()
  const { client } = makeAdmin([
    { package_name: 'com.whatsapp', category: 'messaging' },
  ])
  await getEnabledAppCategories(client)
  assertEquals(isSocialMediaPackage(new Set(['com.whatsapp']), 'com.whatsapp'), true)
  assertEquals(isSocialMediaPackage(new Set(['com.whatsapp']), 'com.android.chrome'), false)
  assertEquals(isSocialMediaPackage(new Set(['com.whatsapp']), null), false)
  assertEquals(isSocialMediaPackage(new Set(['com.whatsapp']), undefined), false)
  assertEquals(isSocialMediaPackage(new Set(['com.whatsapp']), ''), false)
})

Deno.test('cache: empty DB result is tolerated (no crash)', async () => {
  _resetCacheForTests()
  const { client, state } = makeAdmin([])
  const { packages, categories } = await getEnabledAppCategories(client)
  assertEquals(state.callCount, 1)
  assertEquals(packages.size, 0)
  assertEquals(categories.size, 0)
})
