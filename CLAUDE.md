# Job Application Tracker — Project Context for Claude

## What This Is
A fully automated job application pipeline. Find fresh SWE jobs (< 24h old, US/Remote) on Ashby, Greenhouse, and Lever → score them against your resume → batch-apply via Simplify → auto-mark as applied via Chrome extension → monitor Gmail for rejections/interviews → flag no-response jobs after 7 days.

**Entirely free to run** using Vercel + Neon + GitHub Actions + Cloudflare R2 free tiers.

## Architecture Summary
- **web/** — Next.js App Router → deployed on Vercel (free tier)
- **scraper/** — Node.js + Playwright → runs in GitHub Actions ubuntu-latest (NOT Railway)
- **extension/** — Chrome Extension MV3 → auto-detects ATS confirmation pages, marks applied
- **.github/workflows/** — scraper.yml + email-sync.yml, cron every 2h (use public repo for free minutes)
- **Neon Postgres** via Prisma ORM
- **Cloudflare R2** for PDF job snapshots (10 GB free)
- **GitHub Actions** as the only background job runner

## Implementation Status
**PLANNING COMPLETE — READY TO IMPLEMENT**

Implement in this order, completing and testing each step before proceeding:

- [x] Step 1: Monorepo scaffold + Prisma schema + Neon connection
- [ ] Step 2: NextAuth.js (Google + GitHub OAuth)
- [ ] Step 3: AI provider abstraction + resume parsing
- [ ] Step 4: POST /api/jobs/ingest route
- [ ] Step 5: Scraper (Ashby + Greenhouse + Lever)
- [ ] Step 6: Cloudflare R2 PDF snapshots
- [ ] Step 7: GitHub Actions workflows
- [ ] Step 8: Settings page (per-user credentials)
- [ ] Step 9: Gmail OAuth + email sync
- [ ] Step 10: Dashboard shell + job feed
- [ ] Step 11: Chrome extension
- [ ] Step 12: Batch apply queue UI
- [ ] Step 13: Analytics page

**Each step: implement → run test → test passes → move to next step.**

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
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL

# GitHub Actions Secrets (same values)
VERCEL_URL
INGEST_BEARER_TOKEN
EMAIL_SYNC_BEARER_TOKEN
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
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
      gmail.ts + r2.ts + crypto.ts + prisma.ts
    prisma/schema.prisma
  scraper/
    src/
      scrapers/ashby.ts + greenhouse.ts + lever.ts
      utils/filter.ts + pdf.ts + r2.ts + ingest.ts
      index.ts
  extension/
    manifest.json + content.js + background.js + options.html + popup.html
  .github/workflows/
    scraper.yml
    email-sync.yml
  CLAUDE.md               # ← you are here
```
