# Job Application Tracker — Project Context for Claude

## What This Is

A fully automated job application pipeline. Find fresh SWE jobs (< 24h old, US/Remote) on Ashby, Greenhouse, and Lever → score them against your resume → batch-apply via Simplify → auto-mark as applied via Chrome extension → monitor Gmail for rejections/interviews → flag no-response jobs after 7 days.

**Entirely free to run** using Vercel + Neon + GitHub Actions + Vercel Blob free tiers.

## Architecture Summary

- **web/** — Next.js App Router → deployed on Vercel (free tier)
- **scraper/** — Node.js + Playwright → runs in GitHub Actions ubuntu-latest (NOT Railway)
- **extension/** — Chrome Extension MV3 → auto-detects ATS confirmation pages, marks applied
- **.github/workflows/** — scraper.yml + email-sync.yml, cron every 2h (use public repo for free minutes)
- **Neon Postgres** via Prisma ORM
- **Vercel Blob** for PDF job snapshots (1 GB / 10 GB egress free)
- **GitHub Actions** as the only background job runner

## Implementation Status

**PLANNING COMPLETE — READY TO IMPLEMENT**

Implement in this order, completing and testing each step before proceeding:

- [x] Step 1: Monorepo scaffold + Prisma schema + Neon connection
- [x] Step 2: NextAuth.js (Google + GitHub OAuth)
- [x] Step 3: AI provider abstraction + resume parsing
- [x] Step 4: POST /api/jobs/ingest route
- [x] Step 5: Scraper (Ashby + Greenhouse + Lever)
- [x] Step 6: Vercel Blob PDF snapshots
- [x] Step 7: GitHub Actions workflows (scraper.yml — email-sync.yml deferred to Step 9)
- [ ] Step 8: Settings page (per-user credentials) **use tasteskill for all design work**
- [ ] Step 9: Gmail OAuth + email sync
- [ ] Step 10: Dashboard shell + job feed **use tasteskill for all design work**
- [ ] Step 11: Chrome extension
- [ ] Step 12: Batch apply queue UI **use tasteskill for all design work**
- [ ] Step 13: Analytics page **use tasteskill for all design work**

**Each step: implement → run test → test passes → move to next step.**
**use tasteskill for all design work**

## Key Design Decisions

### Data Model

- `Job` table is **global** (not per-user) — scraper ingests globally, deduped by URL
- `UserJob` junction table holds per-user score, status, emailNote
- Status values: `new | queued | applied | skipped | rejected | interview`

### AI Provider (pluggable, per-user)

Each user configures their own AI provider + API key in Settings:

- `groq` → Llama 3.3 (free default, 14,400 req/day)
- `gemini` → Gemini Flash (1,500 req/day free)
- `rules` → keyword matching (always-free fallback)
- `claude` → Anthropic SDK (optional, pay-per-use)

### Security

- All sensitive tokens (gmailToken, aiApiKey) encrypted with AES-256-GCM (`lib/crypto.ts`)
- `ENCRYPTION_KEY` = 32-byte hex in env, never in DB
- Chrome extension auth via user's `apiKey` field (regeneratable UUID)
- GitHub Actions → API: bearer token in `Authorization` header

### Scraper runs in GitHub Actions (NOT Railway)

- ubuntu-latest runners include Chromium → Playwright works natively
- Public repo = unlimited free minutes (secrets stay in GH Secrets)
- Cron every 2h (not 30min) to stay comfortably within free limits

## Full Spec

See the full design spec: `.claude/plans/i-want-to-create-validated-elephant.md`
(in the Claude config directory, not this repo)

## Environment Variables Needed

```
# Vercel
DATABASE_URL              # Neon Postgres pooled connection string
NEXTAUTH_SECRET           # Random 32-char secret
NEXTAUTH_URL              # https://your-app.vercel.app
GOOGLE_CLIENT_ID          # Google OAuth
GOOGLE_CLIENT_SECRET
INGEST_BEARER_TOKEN       # GH Actions → /api/jobs/ingest
EMAIL_SYNC_BEARER_TOKEN   # GH Actions → /api/email/sync
ENCRYPTION_KEY            # 32-byte hex for AES-256-GCM
BLOB_READ_WRITE_TOKEN     # Vercel Blob (PDF snapshots)

# GitHub Actions Secrets (same values)
VERCEL_URL
INGEST_BEARER_TOKEN
EMAIL_SYNC_BEARER_TOKEN
BLOB_READ_WRITE_TOKEN
```

## Monorepo Structure

```
job-tracker/
  web/                    # Next.js → Vercel
    app/
      (auth)/
      dashboard/
      analytics/
      settings/
      api/
        auth/[...nextauth]/
        jobs/ingest/ + route.ts + [id]/status/ + applied/
        email/sync/ + connect/
    lib/
      ai/provider.ts + groq.ts + gemini.ts + rules.ts + claude.ts
      gmail.ts + crypto.ts + prisma.ts
    prisma/schema.prisma
  scraper/
    src/
      scrapers/ashby.ts + greenhouse.ts + lever.ts
      utils/filter.ts + ingest.ts + snapshot.ts
      index.ts
  extension/
    manifest.json + content.js + background.js + options.html + popup.html
  .github/workflows/
    scraper.yml
    email-sync.yml
  CLAUDE.md               # ← you are here
```
