create table public.legal_documents (
  key text primary key,
  title text not null,
  content text not null,
  updated_at timestamptz not null default now()
);

alter table public.legal_documents enable row level security;

create policy "legal read" on public.legal_documents
  for select to authenticated using (true);

insert into public.legal_documents (key, title, content) values
('privacy', 'Privacy Policy',
E'# Privacy Policy\n\n## What we collect\nSync Guardian mirrors notifications from a paired child device to your parent account. We store notification titles, bodies, source apps, and timestamps.\n\n## How we protect your data\n- Notification content is encrypted at rest with AES-256-GCM using a per-pair key (see Encryption section in Settings).\n- All data is protected by Supabase Row-Level Security — you can only read your own pair''s data.\n- We never sell or share your data with advertisers.\n\n## Retention\n- Guardian tier: 30 days of activity history.\n- Guardian+ tier: 90 days.\n\n## Your rights\nYou can revoke any paired device at any time from Settings. Revoking deletes the pair and its mirrored data immediately.'),

('terms', 'Terms of Service',
E'# Terms of Service\n\n## The service\nSync Guardian provides real-time notification monitoring between a parent device and a paired child device.\n\n## Subscriptions\n- Subscriptions are billed via UPI AutoPay (PhonePe).\n- You can cancel anytime — access continues until the end of the current billing period.\n- Refunds are governed by the cancellation flow in Settings.\n\n## Acceptable use\n- Use Sync Guardian only on devices you own or have explicit authority to monitor.\n- Do not use Sync Guardian to stalk, harass, or surveil individuals without consent.\n\n## Disclaimer\nSync Guardian is a parental awareness tool, not a security or child-protection product. The service is provided as-is.'),

('licenses', 'Open-source licenses',
E'# Open-source licenses\n\nSync Guardian is built on the shoulders of giants. The following open-source software is used in this app.\n\n## Runtime\n- React Native \u2014 MIT\n- Expo \u2014 MIT\n- Expo Router \u2014 MIT\n- Supabase JS \u2014 MIT\n- React Native Reanimated \u2014 MIT\n- React Native Gesture Handler \u2014 MIT\n- React Navigation \u2014 MIT\n\n## Markdown rendering\n- react-native-markdown-display \u2014 MIT (Copyright (c) 2021 Chan Myae Kyaw)\n\n## Utilities\n- date-fns \u2014 MIT\n- zustand \u2014 MIT\n- immer \u2014 MIT\n\nFull license texts are bundled with each library at build time.');
