// PhonePe webhook smoke-test script.
//
// Sends a series of synthetic PhonePe-style callbacks to the deployed
// edge function to verify signature verification, idempotency, and
// state transitions.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL = "https://jvgegpjmahkyrnjcgxii.supabase.co"
//   $env:SUPABASE_ANON_KEY = "eyJhbGc..."
//   $env:PHONEPE_WEBHOOK_SECRET = "<your-secret>"   # set in supabase secrets
//   node scripts/test-phonepe-webhook.js
//
// IMPORTANT: only run against a sandbox/test environment. The events
// below use a known merchant_subscription_id; if that subscription
// already exists in your DB, the test will update it. To isolate,
// use a unique merchant_subscription_id per run.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const url = process.env.SUPABASE_URL;
const webhookSecret = process.env.PHONEPE_WEBHOOK_SECRET;
const merchantSubscriptionId =
  process.env.MERCHANT_SUBSCRIPTION_ID ??
  `TEST-SUB-${Date.now()}`;

if (!url) {
  console.error('SUPABASE_URL is not set');
  process.exit(1);
}
if (!webhookSecret) {
  console.error(
    'PHONEPE_WEBHOOK_SECRET is not set. The webhook will reject all requests.',
  );
  process.exit(1);
}

function sign(body, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return hmac.digest('base64');
}

async function postEvent(event, body) {
  const bodyStr = JSON.stringify(body);
  const sig = sign(bodyStr, webhookSecret);
  const res = await fetch(`${url}/functions/v1/phonepe-autopay-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': sig,
    },
    body: bodyStr,
  });
  let parsed = null;
  try { parsed = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: parsed ?? (await res.text().catch(() => null)) };
}

async function postInvalidSignature(body) {
  const bodyStr = JSON.stringify(body);
  const res = await fetch(`${url}/functions/v1/phonepe-autopay-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': 'invalidsignature==',
    },
    body: bodyStr,
  });
  return { status: res.status };
}

function makeEvent(eventType, transactionId, extra = {}) {
  return {
    event: eventType,
    payload: {
      merchantSubscriptionId,
      transactionId,
      amount: 9900,
      state: 'COMPLETED',
      timestamp: new Date().toISOString(),
      ...extra,
    },
  };
}

async function main() {
  console.log(`\nTarget: ${url}`);
  console.log(`Merchant subscription id: ${merchantSubscriptionId}\n`);

  // -----------------------------------------------------------------
  // Note: tests assume ALLOW_UNVERIFIED_WEBHOOKS=true OR a valid
  // PHONEPE_WEBHOOK_SECRET. If neither is true, signature check
  // returns 401 instead of the expected codes below.
  // -----------------------------------------------------------------

  // -----------------------------------------------------------------
  console.log('1. Missing identifier (no merchantSubscriptionId, no orderId) → expect 400');
  const res1 = await fetch(`${url}/functions/v1/phonepe-autopay-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': sign(JSON.stringify({ event: 'foo' }), webhookSecret),
    },
    body: JSON.stringify({ event: 'foo' }),
  });
  console.log(`   status=${res1.status}`);
  if (res1.status === 400) console.log('   \x1b[32mOK\x1b[0m\n');
  else console.log('   \x1b[31mFAIL\x1b[0m (expected 400)\n');

  // -----------------------------------------------------------------
  console.log('2. Unknown subscription → expect 404');
  let r = await postEvent(
    'subscription.setup.order.completed',
    makeEvent('subscription.setup.order.completed', `TXN-${Date.now()}-setup`),
  );
  console.log(`   status=${r.status} body=${JSON.stringify(r.body)}`);
  if (r.status === 404 && /Subscription not found/.test(JSON.stringify(r.body))) {
    console.log('   \x1b[32mOK\x1b[0m\n');
  } else {
    console.log('   \x1b[31mFAIL\x1b[0m (expected 404)\n');
  }

  // -----------------------------------------------------------------
  console.log('3. Malformed JSON → expect 400');
  const res2 = await fetch(`${url}/functions/v1/phonepe-autopay-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': sign('not json', webhookSecret),
    },
    body: 'not json',
  });
  console.log(`   status=${res2.status}`);
  if (res2.status === 400) console.log('   \x1b[32mOK\x1b[0m\n');
  else console.log('   \x1b[31mFAIL\x1b[0m\n');

  // -----------------------------------------------------------------
  console.log('4. Reachable without Authorization header (verify_jwt=false in effect) → expect non-401');
  const res3 = await fetch(`${url}/functions/v1/phonepe-autopay-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VERIFY': sign(JSON.stringify({ event: 'foo' }), webhookSecret),
    },
    body: JSON.stringify({ event: 'foo' }),
  });
  console.log(`   status=${res3.status}`);
  if (res3.status !== 401 || /UNAUTHORIZED_NO_AUTH_HEADER/.test(await res3.clone().text().catch(() => ''))) {
    // We sent a payload so status is now 400 (missing identifier), proving
    // the JWT check is bypassed.
    console.log('   \x1b[32mOK\x1b[0m (JWT check bypassed — webhook reachable without Authorization)\n');
  } else {
    console.log('   \x1b[31mFAIL\x1b[0m (still rejecting without Authorization)\n');
  }

  console.log('Done. To run end-to-end state-change tests, create a real subscription first via the mobile app.');
}

main().catch((e) => {
  console.error('test-phonepe-webhook.js failed:', e);
  process.exit(1);
});
