# Step 2 Design: NextAuth.js (Google + GitHub OAuth)

**Date:** 2026-04-26
**Status:** Draft

---

## Overview

Wire Auth.js v5 into the web package with two OAuth providers (Google and GitHub), a Prisma-backed database session store, a custom sign-in page, and middleware-based route protection for dashboard, analytics, and settings routes. One additive field (`emailVerified DateTime?`) is appended to the existing `User` model. No new tables are introduced.

---

## Architecture

### Auth.js Version

Auth.js v5 (`next-auth@beta`). This is the current, actively maintained major version with native Next.js App Router support: `auth()` works directly in server components, `signIn`/`signOut` are server actions callable from RSC forms, and React 19 / Next.js 15 are first-class targets. v4 requires compatibility shims for this stack. v5 has been beta-stable since late 2024 and is production-ready despite the beta label.

### File Layout

Files created:

| File | Role |
|------|------|
| `web/auth.config.ts` | Edge-safe NextAuth config: providers, pages redirect, authorized callback |
| `web/auth.ts` | Full NextAuth init: spreads authConfig, adds PrismaAdapter and session strategy |
| `web/middleware.ts` | Route guard; explicit matcher for protected routes only |
| `web/app/api/auth/[...nextauth]/route.ts` | NextAuth route handler (GET + POST) |
| `web/app/(auth)/signin/page.tsx` | Custom sign-in UI — shadcn Card with server action forms |
| `web/.env.local` | AUTH_SECRET and OAuth credentials (gitignored, runtime-only) |

Files modified:

| File | Change |
|------|--------|
| `web/prisma/schema.prisma` | Add `emailVerified DateTime?` to User model |
| `web/package.json` | Add `next-auth@beta` and `@auth/prisma-adapter` to dependencies |

### Why Two Auth Config Files

The Prisma adapter uses `@prisma/client`, which relies on Node.js APIs and is incompatible with the Edge runtime. Next.js middleware runs in the Edge runtime. Importing `@auth/prisma-adapter` in `middleware.ts` causes a build failure.

The solution is a split configuration:

- **`auth.config.ts`** — Edge-safe. Imports only provider configs. Contains the providers array, sign-in page redirect, and the `authorized` callback. Middleware imports only this file.
- **`auth.ts`** — Node.js only. Spreads `authConfig`, adds `PrismaAdapter(prisma)` and `session: { strategy: "database" }`. Route handlers and server components import this.

The middleware creates its own NextAuth instance from `authConfig` alone, validating session cookies cryptographically via `AUTH_SECRET` without touching the database.

### Session Strategy

Database sessions — the default when an adapter is provided. The `Session` table exists and was designed for this. Database sessions support server-side revocation: deleting a `Session` row immediately invalidates that session. The cookie contains only an opaque token ID.

In middleware (Edge), Auth.js validates the session cookie using `AUTH_SECRET` without a DB round-trip. In server components, `auth()` queries the `Session` table for the full session. This is one additional DB query per authenticated page — acceptable at this scale.

### Route Protection

Middleware runs exclusively on routes in `config.matcher`. The matcher explicitly lists:

```
/dashboard/:path*
/analytics/:path*
/settings/:path*
```

All other routes (`/`, `/signin`, `/api/auth/*`, `/api/jobs/ingest`, `/api/email/sync`, `/_next/*`) are never touched by middleware. The `authorized` callback is `return !!auth` — valid session passes through, otherwise redirect to `/signin`.

### Sign-in Page

Custom page at `web/app/(auth)/signin/page.tsx`, rendering at URL `/signin`. Configured via `pages: { signIn: "/signin" }` in auth.config.ts. Uses shadcn `Card` and `Button`. Each provider is a `<form>` with an inline server action calling `signIn("google"|"github", { redirectTo: "/dashboard" })`. No client-side JavaScript involved.

### Session Helper in Server Components

```ts
import { auth } from "@/auth"

export default async function SomePage() {
  const session = await auth()
  if (!session) return null
  return <div>Welcome, {session.user?.name}</div>
}
```

---

## Schema Change

Add `emailVerified DateTime?` to the `User` model. The Auth.js Prisma adapter's TypeScript types expect this field. It is written during email-based verification flows; OAuth-only sign-in does not write to it, but the adapter's type signatures require the column to exist.

The field is nullable and additive — non-breaking.

**Migration SQL (for reference):** `ALTER TABLE "User" ADD COLUMN "emailVerified" TIMESTAMP(3);`

`prisma validate` and `prisma generate` pass with a placeholder `DATABASE_URL`. `prisma migrate dev` requires a real Neon connection and is deferred. This does not block typecheck or build for Step 2.

---

## User.apiKey Auto-Generation

`User.apiKey` is `@unique @default(cuid())`. When the Prisma adapter calls `prisma.user.create(...)` during first OAuth sign-in, Prisma applies the default automatically. No custom callbacks or `events.createUser` hooks are needed.

---

## Environment Variables

### New Variables in Step 2

| Variable | Set in | Description |
|----------|--------|-------------|
| `AUTH_SECRET` | `web/.env.local` | 32-byte random secret. Encrypts session cookies and tokens. Generate: `npx auth secret` or `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` | `web/.env.local` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | `web/.env.local` | Google OAuth client secret |
| `AUTH_GITHUB_ID` | `web/.env.local` | GitHub OAuth app client ID |
| `AUTH_GITHUB_SECRET` | `web/.env.local` | GitHub OAuth app client secret |
| `AUTH_URL` | `web/.env.local` (dev only) | `http://localhost:3000`. Auto-inferred on Vercel — do not set in production. |

### CLAUDE.md Alignment

CLAUDE.md uses v4-era variable names. The differences:

| CLAUDE.md name | Auth.js v5 name | Notes |
|----------------|-----------------|-------|
| `NEXTAUTH_SECRET` | `AUTH_SECRET` | Accepted as alias in v5 — works but deprecated |
| `NEXTAUTH_URL` | `AUTH_URL` | Accepted as alias in v5 — works but deprecated |
| `GOOGLE_CLIENT_ID` | `AUTH_GOOGLE_ID` | **Not aliased.** v5 will not auto-infer from `GOOGLE_CLIENT_ID`. Must change. |
| `GOOGLE_CLIENT_SECRET` | `AUTH_GOOGLE_SECRET` | **Not aliased.** Must change. |
| *(missing)* | `AUTH_GITHUB_ID` | Add to CLAUDE.md |
| *(missing)* | `AUTH_GITHUB_SECRET` | Add to CLAUDE.md |

CLAUDE.md should be updated to use `AUTH_*` naming throughout.

### Env File Strategy

- **`web/.env`** — `DATABASE_URL` only. Loaded by Prisma CLI. Created in Step 1. Not modified in this step.
- **`web/.env.local`** — `AUTH_SECRET`, OAuth credentials, `AUTH_URL`. Loaded by Next.js runtime only. Created in this step.

Both are gitignored. Never merge them — keeping them separate makes the Prisma CLI vs. Next.js runtime distinction explicit.

---

## OAuth Callback URLs to Register

| Provider | Dev | Production |
|----------|-----|------------|
| Google | `http://localhost:3000/api/auth/callback/google` | `https://your-app.vercel.app/api/auth/callback/google` |
| GitHub | `http://localhost:3000/api/auth/callback/github` | `https://your-app.vercel.app/api/auth/callback/github` |

Create two separate OAuth credentials per provider (dev + prod). Do not reuse the same client for both.

Google default scopes: `openid`, `email`, `profile`. No Gmail access at this step (Step 9).

---

## Auth Flow

```
1. User navigates to /dashboard (no session)
       └─ middleware: no valid session cookie → redirect to /signin

2. User on /signin
       └─ Card renders with Google and GitHub buttons

3. User clicks "Continue with Google"
       └─ server action → signIn("google") → redirect to Google auth URL

4. Google OAuth completed
       └─ redirect to /api/auth/callback/google?code=...
       └─ Auth.js: exchange code → fetch profile
       └─ PrismaAdapter.getUserByAccount() → not found → createUser()
              └─ User row: email, name, image, emailVerified=null, apiKey=<cuid>
       └─ PrismaAdapter.linkAccount() → Account row
       └─ PrismaAdapter.createSession() → Session row, token in HttpOnly cookie
       └─ redirect to /dashboard

5. /dashboard request
       └─ middleware: valid session cookie → allow through
       └─ server component: auth() → queries Session table → returns session
       └─ (404 until Step 10 implements the dashboard)
```

---

## Security Notes

- `AUTH_SECRET` minimum 32 bytes, cryptographically random. Rotating it immediately invalidates all existing sessions.
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` (production). Cookie contains only the opaque session token ID.
- Explicit middleware matcher means `/api/jobs/ingest` and `/api/email/sync` are never run through the session guard. Those endpoints enforce bearer token auth independently (Steps 4, 9).
- Google default scopes do not include Gmail. Gmail OAuth is Step 9.
- `Account` and `Session` have `onDelete: Cascade` — deleting a user cleans up all auth data.

---

## Testing Approach

**Without real DATABASE_URL:**
- `pnpm tsc --noEmit` — must pass
- `pnpm build` — must pass; middleware Edge bundle compiles without Node.js errors
- Navigate to `/signin` — Card with provider buttons renders
- Navigate to `/dashboard` — redirects to `/signin`

**With real DATABASE_URL + valid OAuth credentials:**
- `prisma migrate dev --name add-email-verified`
- Click Google → OAuth flow → redirect to `/dashboard` (404 until Step 10)
- `prisma studio` → verify User, Account, Session rows created

---

## Decisions to Confirm

1. **Auth.js v5 (`next-auth@beta`) vs v4.** Recommended: v5. Native App Router support, server action `signIn`, no React 19/Next.js 15 shims. Risk: beta label — accepted, API stable since late 2024.

2. **Database session strategy vs JWT.** Recommended: database. `Session` table exists; supports server-side revocation. One extra DB query per authenticated page. Switch to JWT with one line change if needed.

3. **Custom sign-in page vs default Auth.js page.** Recommended: custom. Consistent with shadcn; 30 lines; easily overridden.

4. **Explicit middleware matcher vs broad negative matcher.** Recommended: explicit. Listing only the three route prefixes is unambiguous. New protected routes added explicitly.

5. **`AUTH_*` naming vs CLAUDE.md `NEXTAUTH_*` / `GOOGLE_CLIENT_ID`.** Recommended: update CLAUDE.md to `AUTH_*`. `GOOGLE_CLIENT_ID` is not aliased in v5 — it will silently fail. `AUTH_GOOGLE_ID` is required.

6. **GitHub callback URL: `/api/auth/callback/github`.** Confirmed — standard Auth.js path for Next.js. Register this exactly.

---

## What This Step Does NOT Include

- Gmail OAuth (Step 9)
- AI provider wiring (Step 3)
- `POST /api/jobs/ingest` (Step 4) — bearer token, not session-based
- Dashboard UI (Step 10) — `/dashboard` 404s after redirect
- `SessionProvider` in root layout — needed only for client component `useSession` (Step 10)
- Sign-out UI button — `/api/auth/signout` available; UI is Step 10
- User settings page (Step 8)
- Actual DB migration — deferred until real Neon DATABASE_URL is set
- Vercel deployment and production env var configuration
