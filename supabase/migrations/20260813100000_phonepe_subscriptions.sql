-- ============================================================
-- PhonePe Autopay subscription billing schema.
--
-- Tables:
--   plans                 – catalog of purchasable plans (seeded below)
--   subscriptions         – one active subscription per user (edge-function writes)
--   subscription_events   – append-only audit log written by edge functions
--   user_trials           – standard 7-day trial, auto-created on signup
--
-- All writes go through Edge Functions with service_role (AGENTS.md rule 3).
-- Authenticated users only get SELECT on their own rows.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. plans
-- ------------------------------------------------------------------
CREATE TABLE plans (
  id              TEXT PRIMARY KEY,
  tier            TEXT NOT NULL CHECK (tier IN ('tier_a', 'tier_b')),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  frequency       TEXT NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  amount_paise    INTEGER NOT NULL CHECK (amount_paise >= 100),
  max_amount_paise INTEGER NOT NULL CHECK (max_amount_paise >= 100),
  discount_label  TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frequencies map to PhonePe V2 autopay `frequency` values:
-- monthly -> MONTHLY, yearly -> YEARLY
-- maxAmount is capped by PhonePe at ₹15,000 (1_500_000 paise).

-- Seed 4 plans (test amounts; adjust in SQL before go-live).
INSERT INTO plans (id, tier, name, description, frequency, amount_paise, max_amount_paise, discount_label, sort_order) VALUES
  ('tier_a_monthly', 'tier_a', 'Tier A Monthly', 'Monthly monitoring plan', 'monthly', 100, 100, NULL, 1),
  ('tier_a_yearly',  'tier_a', 'Tier A Yearly',  'Yearly monitoring plan',  'yearly',  1000, 1000, 'Save ₹2', 2),
  ('tier_b_monthly', 'tier_b', 'Tier B Monthly', 'Monthly monitoring plan', 'monthly', 200, 200, NULL, 3),
  ('tier_b_yearly',  'tier_b', 'Tier B Yearly',  'Yearly monitoring plan',  'yearly',  2000, 2000, 'Save ₹4', 4)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------
-- 2. subscriptions
-- ------------------------------------------------------------------
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                 TEXT NOT NULL REFERENCES plans(id),
  status                  TEXT NOT NULL CHECK (status IN ('pending', 'active', 'paused', 'expired', 'cancelled', 'revoked')),
  merchant_order_id       TEXT,
  merchant_subscription_id TEXT UNIQUE,
  phonepe_order_id        TEXT,
  last_charge_amount_paise INTEGER,
  current_cycle_start     TIMESTAMPTZ,
  current_cycle_end       TIMESTAMPTZ,
  next_charge_at          TIMESTAMPTZ,
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one live subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_per_user
  ON subscriptions (user_id)
  WHERE status IN ('pending', 'active', 'paused');

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_msub ON subscriptions (merchant_subscription_id);

-- ------------------------------------------------------------------
-- 3. subscription_events (audit log)
-- ------------------------------------------------------------------
CREATE TABLE subscription_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_user ON subscription_events (user_id, created_at DESC);

-- ------------------------------------------------------------------
-- 4. user_trials
-- ------------------------------------------------------------------
CREATE TABLE user_trials (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_trials_user ON user_trials (user_id);

-- Auto-create a 7-day trial when a user signs up.
CREATE OR REPLACE FUNCTION handle_new_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_trials (user_id, status, started_at, ends_at)
  VALUES (NEW.id, 'active', now(), now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_trial_created ON auth.users;
CREATE TRIGGER on_auth_user_trial_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_trial();

-- Backfill trials for existing users who don't have one yet.
INSERT INTO public.user_trials (user_id, status, started_at, ends_at)
SELECT id, 'active', now(), now() + interval '7 days'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ------------------------------------------------------------------
-- RLS + grants
-- ------------------------------------------------------------------
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trials ENABLE ROW LEVEL SECURITY;

-- Plans are public catalog data; authenticated users may read.
GRANT SELECT ON TABLE plans TO authenticated;
CREATE POLICY "plans_read_all_authenticated" ON plans
  FOR SELECT TO authenticated USING (true);

-- Subscriptions: read own only; writes via edge functions (service_role).
GRANT SELECT ON TABLE subscriptions TO authenticated;
CREATE POLICY "subscriptions_read_own" ON subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- subscription_events: no authenticated access (audit log is server-side only).
REVOKE ALL ON TABLE subscription_events FROM authenticated, anon;

-- user_trials: read own only; writes via trigger/edge functions.
GRANT SELECT ON TABLE user_trials TO authenticated;
CREATE POLICY "user_trials_read_own" ON user_trials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER set_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_subscriptions_updated_at();

DROP TRIGGER IF EXISTS set_user_trials_updated_at ON user_trials;
CREATE TRIGGER set_user_trials_updated_at BEFORE UPDATE ON user_trials
  FOR EACH ROW EXECUTE FUNCTION set_subscriptions_updated_at();
