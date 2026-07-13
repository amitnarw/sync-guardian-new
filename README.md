# Sync Guardian

A notification mirroring app that lets parents monitor notifications on their child's Android device securely and in real-time.

## Architecture

```
mobile/          — Expo (React Native) Android app
supabase/        — Supabase project (PostgreSQL, Edge Functions, Auth)
  config.toml    — Supabase configuration
  migrations/    — Database schema migrations
  functions/     — Edge Functions
    _shared/     — Shared utilities (auth, FCM, validation, JWTs)
    create-pairing-token/
    claim-pairing-token/
    ingest-child-notification/
    get-notifications/
    ping-child/
    revoke-pair/
    sync-device/
    get-onboarding-state/
    set-onboarding-role/
    sync-installed-apps/
    update-app-filters/
    backfill-encrypt-notifications/
    health/
```

## Tech Stack

- **Mobile**: Expo SDK 55, React Native 0.83, TypeScript, Zustand
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Push**: Firebase Cloud Messaging (FCM) v1 API
- **Auth**: Supabase Auth (Google OAuth only)
- **Storage**: Supabase PostgreSQL with Row-Level Security

## Setup

### Prerequisites

- Node.js 20+, npm
- Expo CLI (`npx expo`)
- Supabase CLI (`supabase`)
- Android device/emulator for testing

### Mobile

```bash
cd mobile
cp .env.example .env
# Fill in your Supabase URL, anon key, and Google OAuth client IDs
npm install
npx expo run:android
```

### Supabase (local dev)

```bash
cd supabase
supabase start
supabase db push
supabase functions serve
```

### Required Environment Variables

See `mobile/.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client ID |

Edge function secrets (set via `supabase secrets set` or EAS):

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase service account JSON |
| `QR_JWT_SECRET` | Secret for signing QR pairing JWTs |
| `NOTIFICATION_ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM encryption of notification content |

## Security

- **Row-Level Security**: All database tables have RLS enabled. Mutations go through Edge Functions (service_role).
- **Authentication**: JWT-based via Supabase Auth.
- **Pairing**: QR codes use signed JWTs with 10-minute expiry.
- **Push**: FCM v1 API with OAuth2 service account authentication.

## Compliance

- [Privacy Policy](docs/PRIVACY_POLICY.md)
- [Terms of Service](docs/TERMS_OF_SERVICE.md)
- [COPPA Notice](docs/COPPA_NOTICE.md)
- [GDPR Notice](docs/GDPR_NOTICE.md)

*Review these documents with legal counsel before public release.*

## License

Private — All rights reserved.
