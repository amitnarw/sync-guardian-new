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
- Never expose real UUIDs or tokens in log output.
- Validate all inputs in Edge Functions (`_shared/validation.ts`).
- Use `crypto.getRandomValues()` for cryptographic randomness.
- HMAC-SHA256 for JWT signing (QR codes), not raw tokens in URLs.

## Testing

- Edge Functions: Deno test framework
- Mobile: Jest + React Native Testing Library
