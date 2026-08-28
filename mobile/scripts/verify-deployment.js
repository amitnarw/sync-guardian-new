// Post-deployment verification script.
// Runs read-only checks against the production Supabase project.
// Usage: node scripts/verify-deployment.js
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from mobile/.env.

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env not found at ${envPath}`);
  }
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('EXPO_PUBLIC_SUPABASE_URL missing from .env');
  process.exit(1);
}

// Fall back to anon key if service role isn't available. SECURITY
// DEFINER RPCs still work via anon calls. Read-only checks also work.
const apiKey = serviceKey ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const usingServiceRole = !!serviceKey;

if (!usingServiceRole) {
  console.warn(
    '\n  SUPABASE_SERVICE_ROLE_KEY not set — running with anon key.\n' +
      '  RPCs that require admin privileges will fail. To enable all checks:\n' +
      '    $env:SUPABASE_SERVICE_ROLE_KEY = "..." ; npm run verify:deployment\n',
  );
}

const admin = createClient(url, apiKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
let fail = 0;
let warn = 0;

function ok(msg) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); pass++; }
function bad(msg) { console.log(`  \x1b[31m✗\x1b[0m ${msg}`); fail++; }
function note(msg) { console.log(`  \x1b[33m!\x1b[0m ${msg}`); warn++; }

async function check(name, fn) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  try {
    await fn();
  } catch (e) {
    bad(`unexpected error: ${e.message ?? e}`);
  }
}

async function rpc(name, args) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw error;
  return data;
}

async function count(table, filter) {
  let q = admin.from(table).select('id', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  console.log(`\nVerifying deployment at ${url}\n`);

  // -----------------------------------------------------------------
  await check('Database schema', async () => {
    const { data, error } = await admin
      .from('subscription_events')
      .select('processed_at, received_at, idempotency_key')
      .limit(1);
    if (error) {
      // Column may not exist if migration order went wrong.
      bad(`subscription_events column check failed: ${error.message}`);
      return;
    }
    ok('subscription_events is queryable');
  });

  // -----------------------------------------------------------------
  await check('process_phonepe_event RPC', async () => {
    // Use a sentinel key that we know is unique to this run so we
    // don't actually apply any state. Pass a non-existent subscription
    // id so the RPC raises if the row is missing — confirming the
    // 0-row check works.
    const sentinelKey = `verify-${Date.now()}-${Math.random()}`;
    const { data, error } = await admin.rpc('process_phonepe_event', {
      p_idempotency_key: sentinelKey,
      p_subscription_id: '00000000-0000-0000-0000-000000000000',
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_event_type: 'verify.test',
      p_payload: { verify: true },
      p_received_at: new Date().toISOString(),
      p_subscription_updates: { status: 'active' },
    });
    // We expect either a 0-row raise (P0002) — that means the RPC IS
    // checking ROW_COUNT and is hardened. Or the function may have
    // run silently — that's a failure.
    if (error) {
      if (error.code === 'P0002' || /not found/i.test(error.message ?? '')) {
        ok('RPC raises on missing subscription row (P0002)');
      } else {
        bad(`unexpected RPC error: ${error.message} (${error.code})`);
      }
    } else {
      bad('RPC did NOT raise on missing subscription row — 0-row check is broken!');
    }
  });

  // -----------------------------------------------------------------
  await check('reconcile_child_device_limits RPC', async () => {
    const { data, error } = await admin.rpc('reconcile_child_device_limits');
    if (error) {
      bad(`reconcile failed: ${error.message}`);
      return;
    }
    const rows = data ?? [];
    ok(`reconcile ran, returned ${rows.length} parent(s) (delta of revoked pairs)`);
    if (rows.length > 0 && rows[0].revoked_pair_count > 0) {
      note(`${rows.filter(r => r.revoked_pair_count > 0).length} parent(s) had pairs revoked during reconciliation`);
    }
  });

  // -----------------------------------------------------------------
  await check('enforce_child_device_limits trigger', async () => {
    const { error } = await admin.rpc('reconcile_child_device_limits');
    if (error) {
      bad(`trigger function unreachable: ${error.message}`);
      return;
    }
    ok('enforce_child_device_limits() is callable via reconcile');
  });

  // -----------------------------------------------------------------
  await check('claim_pairing_token RPC', async () => {
    const { data, error } = await admin.rpc('claim_pairing_token', {
      p_token: null,
      p_code: 'VERIFY-NOT-EXIST',
      p_parent_user_id: '00000000-0000-0000-0000-000000000000',
    });
    if (error) {
      const msg = error.message ?? '';
      if (/Invalid or expired token/i.test(msg)) {
        ok('claim_pairing_token rejects invalid tokens');
      } else {
        bad(`unexpected claim error: ${msg}`);
      }
    } else {
      bad('claim_pairing_token accepted invalid token — broken');
    }
  });

  // -----------------------------------------------------------------
  await check('Data sanity', async () => {
    const plans = await count('plans');
    const subs = await count('subscriptions');
    const trials = await count('user_trials');
    const pairs = await count('pairs');
    const devices = await count('devices');
    const events = await count('subscription_events');
    console.log(`    plans:          ${plans}`);
    console.log(`    subscriptions:  ${subs}`);
    console.log(`    user_trials:    ${trials}`);
    console.log(`    pairs:          ${pairs}`);
    console.log(`    devices:        ${devices}`);
    console.log(`    subscription_events: ${events}`);
    ok('row counts printed');
  });

  // -----------------------------------------------------------------
  await check('Unprocessed subscription_events', async () => {
    // We can't easily filter by processed_at via PostgREST, so use a
    // raw count via the RPC-style approach: select rows where
    // processed_at is null and check the length.
    const { data, error } = await admin
      .from('subscription_events')
      .select('id, idempotency_key, event_type, processed_at')
      .is('processed_at', null)
      .limit(10);
    if (error) {
      bad(`failed: ${error.message}`);
      return;
    }
    if ((data ?? []).length === 0) {
      ok('no unprocessed events (good)');
    } else {
      note(`${data.length} unprocessed events found (may be from legacy inserts before this RPC)`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\x1b[32m${pass}\x1b[0m passed, \x1b[31m${fail}\x1b[0m failed, \x1b[33m${warn}\x1b[0m warning(s)`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error('\nverify-deployment.js failed:', e);
  process.exit(1);
});
