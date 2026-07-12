# Sync Guardian — Agent Instructions

## Architecture Rules

1. **Auth**: `isAuthenticated` is derived from Supabase session, NOT persisted in Zustand. `_layout.tsx` is the single source of truth for session restore.
2. **State**: All app state in Zustand store. Persist selects fields (userRole, pairId, deviceId, etc.). Never persist `isAuthenticated` or `userId`.
3. **Backend mutations**: Always go through Edge Functions with `service_role`. Never make direct INSERT/UPDATE/DELETE calls from mobile to Supabase.
4. **RLS**: All tables have Row-Level Security. Authenticated users only get SELECT on their own data.
5. **FCM**: Push notifications go through `_shared/fcm.ts` module, never through separate HTTP edge functions.
6. **Pairing**: QR codes contain signed JWTs (`qr_jwt`), never raw tokens.

## Design System (from CLAUDE.md)

- Colors: Use `AuthColors` / `Colors` tokens only. No inline hex values.
- Typography: Use `PlusJakartaSans-*` and `Manrope-*` via `AuthFonts` tokens.
- Shapes: Radius XL = 32px, Radius Full = 9999px.
- No borders (1px dividers forbidden).

## Security Rules

- Never commit API keys, JWT secrets, or service account JSONs.
- Use `logger` from `@/services/logger` instead of `console.*` in production code.
- Edge functions use `logger` from `supabase/functions/_shared/logger.ts` instead of `console.*`. Error responses are sanitized via `mapError` so internal details (env vars, SQL errors, FCM errors) are never returned to clients.
- Never expose real UUIDs or tokens in log output. `logger` sanitizes UUID/token-like values from log metadata automatically.
- Validate all inputs in Edge Functions (`_shared/validation.ts`).
- Use `crypto.getRandomValues()` for cryptographic randomness.
- HMAC-SHA256 for JWT signing (QR codes), not raw tokens in URLs.

## Encryption at Rest (Notification Content)

- **Scope**: `notification_title`, `notification_body`, `source_package`, `source_app_name`, `metadata_json` on `mirrored_notifications` are encrypted. Other tables/fields are not.
- **Scheme**: AES-256-GCM via WebCrypto. Per-pair key derived via HKDF-SHA256 from a master key + `pair_id`. Each encryption uses a random 12-byte IV. Stored as `nv1:base64(iv + ciphertext + tag)`.
- **Key**: 32-byte random base64 value in Edge Function secret `NOTIFICATION_ENCRYPTION_KEY` (set via `supabase secrets set`). Visible to project owners. Never in DB, mobile app, or Git.
- **Read path**: Parent app calls `get-notifications` edge function (JWT auth) which decrypts server-side with `service_role`. Direct `SELECT` from Supabase returns ciphertext only.
- **Write path**: `ingest-child-notification` encrypts plaintext fields before upsert. FCM push uses plaintext from in-memory rows (before encryption).

**Key rotation runbook** (rotating the key breaks existing ciphertext — re-backfill required):
1. `supabase secrets set NOTIFICATION_ENCRYPTION_KEY="$(openssl rand -base64 32)"`
2. Temporarily re-deploy `backfill-encrypt-notifications` (from `supabase/functions/backfill-encrypt-notifications`)
3. `supabase secrets set BACKFILL_API_KEY="$(openssl rand -base64 16)"`
4. `curl -X POST https://<project>.supabase.co/functions/v1/backfill-encrypt-notifications -H "Authorization: Bearer <anon_key>" -H "x-api-key: <BACKFILL_API_KEY>"`
5. `supabase functions delete backfill-encrypt-notifications`
6. `supabase secrets unset BACKFILL_API_KEY`

**Local dev**: `supabase functions serve` requires `NOTIFICATION_ENCRYPTION_KEY` set locally:
```bash
supabase secrets set --local NOTIFICATION_ENCRYPTION_KEY="..."
```

## Edge Functions Reference

| Function | Auth | Purpose |
|----------|------|---------|
| `ingest-child-notification` | JWT (child user) | Ingest and route notifications to parent |
| `create-pairing-token` | JWT (child user) | Generate QR pairing token + code |
| `claim-pairing-token` | JWT (parent user) | Claim a pairing token and create pair |
| `ping-child` | JWT (parent user) | Send wake-up FCM to child device (triggers child presence sync + MMKV buffer flush) |
| `revoke-pair` | JWT (either user) | Revoke/unpair a device pair |
| `sync-device` | JWT (device owner) | Update device presence, push_token, foreground |
| `get-notifications` | JWT (pair member) | Fetch decrypted notifications for the caller's pair |
| `health` | None (public) | Health check with DB + env var validation |

## Known Gaps (not production-blocking)

- Google OAuth uses URL fragment parsing (deferred; see Phase 1.7 plan)
- Rate limiter in `auth-verifier.ts` is in-memory (per-instance only)
- No Sentry/Crashlytics integration for crash reporting
- Notification crypto tests in `notification-crypto.test.ts` (requires Deno to run)

## Testing

- Edge Functions: Deno test framework
- Mobile: Jest + React Native Testing Library

## E2E Verification (Encryption)

After deploying changes, verify with a paired child + parent device:
1. Child sends a notification → parent receives FCM push with readable title
2. Parent app shows decrypted notification title/body in Home, Activity, Insights tabs
3. In Supabase SQL Editor: `SELECT notification_title, notification_body FROM mirrored_notifications LIMIT 5` → values start with `nv1:` (ciphertext)
4. Call `get-notifications` edge function directly with a valid JWT → returns plaintext content
5. Try reading with a different user's JWT → receives no data (ownership check)

## Verification Commands

- **Typecheck (mobile)**: `npx tsc --noEmit` (no dedicated script; `tsconfig.json` has strict mode + `@/*` path alias)
- **Lint (mobile)**: `npm run lint` (runs `expo lint`)
