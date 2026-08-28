const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envLines = fs.readFileSync('.env', 'utf8').split('\n').filter(l => l && !l.startsWith('#') && l.includes('='));
const env = Object.fromEntries(envLines.map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
const c = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const r1 = await c.rpc('reconcile_child_device_limits');
  if (r1.error) {
    console.error('reconcile_child_device_limits FAIL:', r1.error.message);
  } else {
    console.log('reconcile_child_device_limits OK, parents processed:', (r1.data || []).length);
  }

  const r2 = await c.rpc('process_phonepe_event', {
    p_idempotency_key: 'verify-' + Date.now(),
    p_subscription_id: '00000000-0000-0000-0000-000000000000',
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_event_type: 'verify.test',
    p_payload: {},
    p_received_at: new Date().toISOString(),
    p_subscription_updates: {},
  });
  if (r2.error) {
    console.log('process_phonepe_event:', r2.error.code, '-', r2.error.message.split('\n')[0]);
  } else {
    console.log('process_phonepe_event OK (no-op with empty updates):', JSON.stringify(r2.data));
  }

  const r3 = await c.rpc('claim_pairing_token', {
    p_token: null,
    p_code: 'VERIFY-NOT-EXIST',
    p_parent_user_id: '00000000-0000-0000-0000-000000000000',
  });
  if (r3.error) {
    console.log('claim_pairing_token:', r3.error.code, '-', r3.error.message.split('\n')[0]);
  } else {
    console.log('claim_pairing_token UNEXPECTED OK:', JSON.stringify(r3.data));
  }

  // Data sanity
  for (const table of ['plans', 'subscriptions', 'user_trials', 'pairs', 'devices', 'subscription_events']) {
    const { count, error } = await c.from(table).select('id', { count: 'exact', head: true });
    if (error) {
      console.log(`  ${table}: ERROR ${error.message}`);
    } else {
      console.log(`  ${table}: ${count}`);
    }
  }
})();
