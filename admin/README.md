# Sync Guardian ,  Admin Panel

Next.js 16 (App Router) admin panel for the Sync Guardian Supabase backend.
Full CRUD over all platform tables, with server-side decryption of mirrored
notification content and email-allowlist gated access. Deploys to Vercel.

## Stack

| Layer      | Tech                                                        |
| ---------- | ----------------------------------------------------------- |
| Framework  | Next.js 16 · React 19 · TypeScript strict · Turbopack       |
| Admin      | Refine v5 (`@refinedev/core`) + TanStack Table              |
| UI         | Tailwind CSS v4 + shadcn/ui + Recharts + sonner             |
| Backend    | Custom Refine data provider → Next.js Route Handlers → `service_role` |

## Architecture

- **No direct DB access from the browser.** All reads/writes go through
  `/api/[resource]` route handlers that authenticate the session cookie,
  check `ADMIN_EMAILS`, then query Supabase with the service-role key.
- **Zero DB/RLS changes required.** The service role bypasses RLS; no new
  policies or migrations are needed for admins.
- **Encrypted notifications**: `mirrored_notifications` content fields
  (`notification_title`, `notification_body`, `source_package`,
  `source_app_name`) are AES-256-GCM encrypted at rest (`nv1:` prefix).
  The panel decrypts on read / encrypts on write using
  `NOTIFICATION_ENCRYPTION_KEY` with the same HKDF scheme as the edge
  functions (`supabase/functions/_shared/notification-crypto.ts`).
- **`subscription_events` is read-only** (append-only audit log written by
  webhooks).
- **Auth Users** resource uses `auth.admin` API (list/get/delete) since
  auth users are not exposed through PostgREST.

## Resources

| Group            | Resources                                                            |
| ---------------- | -------------------------------------------------------------------- |
| Overview         | Dashboard (stats, 14-day notification chart, latest activity)        |
| Access & Users   | Auth Users, Profiles, Onboarding State                               |
| Devices & Pairing| Devices, Pairs, Pairing Tokens                                       |
| Notifications    | Mirrored Notifications (decrypted), Push Delivery Logs, App Filters  |
| Monetization     | Plans, Subscriptions, Subscription Events (read-only), User Trials   |
| Content          | App Categories, Legal Documents                                      |

## Local development

```bash
cd admin
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

### Required env vars

See `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and
`NOTIFICATION_ENCRYPTION_KEY` are **server-only** secrets.

### Google OAuth setup

1. Supabase Dashboard → Auth → URL Configuration:
   - Site URL: your deployed origin (e.g. `https://sync-guardian-admin.vercel.app`)
   - Additional redirect URLs: add `http://localhost:3000/auth/callback`
     and `https://<your-domain>/auth/callback`
2. Google Cloud console → OAuth client → Authorized redirect URIs must
   include `https://<project-ref>.supabase.co/auth/v1/callback` (already
   configured if the mobile app uses Google sign-in).

## Deploying to Vercel

1. Push this repo to GitHub.
2. Vercel → New Project → import repo.
3. Set **Root Directory** to `admin`.
4. Add the five environment variables from `.env.example`
   (`SUPABASE_SERVICE_ROLE_KEY` + `NOTIFICATION_ENCRYPTION_KEY` as
   sensitive/server-only values).
5. Deploy. Then add the production domain's `/auth/callback` to Supabase
   redirect URLs (step above).

> Note: a scheduled Next.js security release lands Aug 26, 2026
> (16.3.3). Run `npm install next@latest` after it ships.

## Security notes

- Allowlisting is enforced twice: in `src/proxy.ts` (page access) and in
  every `/api/*` handler (data access). A signed-in non-admin gets
  redirected to `/not-allowed` and receives `403` on APIs.
- The service-role key never reaches the client bundle; it is only read in
  route handlers via `process.env`.
- Deletes cascade per FK constraints (e.g. deleting an auth user removes
  their devices/pairs/notifications). Dangerous resources show explicit
  warnings before confirmation.

## Verification commands

```bash
npx tsc --noEmit   # typecheck
npm run lint       # eslint
npm run build      # production build
```
