-- ============================================================
-- app_categories: source-of-truth whitelist of Android packages
-- that the parent app is allowed to monitor.
--
-- Replaces the previously hardcoded list that lived in two TS files.
-- Edits are now applied via SQL (INSERT / UPDATE / DELETE) without an
-- app release. The mobile app and the sync-installed-apps edge function
-- both read this table through a 5-minute in-memory cache.
-- ============================================================

CREATE TABLE app_categories (
  package_name TEXT PRIMARY KEY,
  category     TEXT NOT NULL CHECK (category IN ('social', 'messaging', 'dating')),
  enabled      BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_categories_enabled
  ON app_categories (enabled)
  WHERE enabled = true;

ALTER TABLE app_categories ENABLE ROW LEVEL SECURITY;

-- The list is not sensitive (every entry is on the Play Store). Both
-- authenticated and anon roles can read.
GRANT SELECT ON TABLE app_categories TO anon, authenticated;

-- Mutations are restricted to service_role (used by edge functions and
-- manual SQL in the Supabase Studio). No INSERT/UPDATE/DELETE policy is
-- granted to authenticated or anon.

CREATE POLICY "app_categories_read_all" ON app_categories
  FOR SELECT TO anon, authenticated USING (true);

-- Seed the canonical list. ON CONFLICT DO NOTHING so re-running the
-- migration is safe. Updates to existing rows must be done via a
-- follow-up UPDATE statement (not part of this migration).
INSERT INTO app_categories (package_name, category) VALUES
  -- Social networks
  ('com.instagram.android',       'social'),
  ('com.facebook.katana',        'social'),
  ('com.facebook.lite',          'social'),
  ('com.facebook.orca',          'messaging'),
  ('com.facebook.mlite',         'messaging'),
  ('com.threads.android',        'social'),
  ('com.zhiliaoapp.musically',   'social'),
  ('com.ss.android.ugc.trill',   'social'),
  ('com.snapchat.android',       'social'),
  ('com.reddit.frontpage',       'social'),
  ('com.linkedin.android',       'social'),
  ('com.pinterest',              'social'),
  ('com.tumblr',                 'social'),
  ('com.discord',                'messaging'),
  ('com.twitter.android',        'social'),
  ('com.x.android',              'social'),
  -- Messaging
  ('com.whatsapp',               'messaging'),
  ('com.whatsapp.w4b',           'messaging'),
  ('org.telegram.messenger',     'messaging'),
  ('org.telegram.messenger.web', 'messaging'),
  ('org.thoughtcrime.securesms', 'messaging'),
  ('com.signal.android',         'messaging'),
  ('com.viber.voip',             'messaging'),
  ('com.tencent.mm',             'messaging'),
  ('jp.naver.line.android',      'messaging'),
  ('com.kakao.talk',             'messaging'),
  ('com.skype.raider',           'messaging'),
  ('com.skype.m2',               'messaging'),
  ('com.imo.android.imoim',      'messaging'),
  ('com.imo.android.imoimbeta',  'messaging'),
  -- Dating
  ('com.tinder',                 'dating'),
  ('com.bumble.app',             'dating'),
  ('com.bumble.bff',             'dating'),
  ('com.hinge.app',              'dating'),
  ('com.match.android',          'dating'),
  ('com.match.mobile',           'dating'),
  ('com.eharmony',               'dating'),
  ('com.zoosk.android',          'dating'),
  ('com.plentyoffish',           'dating')
ON CONFLICT (package_name) DO NOTHING;
