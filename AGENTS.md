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

## Edge Functions Reference

| Function | Auth | Purpose |
|----------|------|---------|
| `ingest-child-notification` | JWT (child user) | Ingest and route notifications to parent |
| `create-pairing-token` | JWT (child user) | Generate QR pairing token + code |
| `claim-pairing-token` | JWT (parent user) | Claim a pairing token and create pair |
| `ping-child` | JWT (parent user) | Send wake-up FCM to child device |
| `revoke-pair` | JWT (either user) | Revoke/unpair a device pair |
| `sync-device` | JWT (device owner) | Update device presence, push_token, foreground |
| `health` | None (public) | Health check with DB + env var validation |

## Known Gaps (not production-blocking)

- Google OAuth uses URL fragment parsing (deferred; see Phase 1.7 plan)
- Rate limiter in `auth-verifier.ts` is in-memory (per-instance only)
- No Sentry/Crashlytics integration for crash reporting
- No test suite yet

## Testing

- Edge Functions: Deno test framework
- Mobile: Jest + React Native Testing Library

## Verification Commands

- **Typecheck (mobile)**: `npx tsc --noEmit` (no dedicated script; `tsconfig.json` has strict mode + `@/*` path alias)
- **Lint (mobile)**: `npm run lint` (runs `expo lint`)
