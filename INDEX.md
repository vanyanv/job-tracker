# Job Tracker Index

## Current State
- Repository status: planning/spec only
- Implemented app code: none yet
- Source of truth: [CLAUDE.md](/Users/vardanvanyan/Desktop/Apps/job-tracker/CLAUDE.md)

## What This App Is
An automated job application pipeline for US/Remote software roles:
- Scrape fresh jobs from Ashby, Greenhouse, and Lever
- Score them against a user's resume
- Queue and submit applications through Simplify
- Mark applications as applied through a Chrome extension
- Sync Gmail for rejections and interview updates
- Surface stale applications with no response after 7 days

## Planned Architecture
- `web/`
  Next.js App Router app deployed on Vercel.
- `scraper/`
  Node.js + Playwright scraper executed in GitHub Actions.
- `extension/`
  Chrome Extension MV3 for ATS confirmation detection and status updates.
- `.github/workflows/`
  Scheduled scraper and email sync workflows.
- `Neon Postgres`
  Primary database, accessed through Prisma.
- `Cloudflare R2`
  Storage for job PDF snapshots.

## Core Data Model
- `Job`
  Global canonical job record, deduped by URL.
- `UserJob`
  Per-user relation storing score, status, and email notes.

Statuses:
- `new`
- `queued`
- `applied`
- `skipped`
- `rejected`
- `interview`

## Planned Monorepo Layout
```text
job-tracker/
  web/
    app/
      (auth)/
      dashboard/
      analytics/
      settings/
      api/
        auth/[...nextauth]/
        jobs/ingest/
        jobs/[id]/status/
        jobs/applied/
        email/sync/
        email/connect/
    lib/
      ai/
        provider.ts
        groq.ts
        gemini.ts
        rules.ts
        claude.ts
      gmail.ts
      r2.ts
      crypto.ts
      prisma.ts
    prisma/
      schema.prisma
  scraper/
    src/
      scrapers/
        ashby.ts
        greenhouse.ts
        lever.ts
      utils/
        filter.ts
        pdf.ts
        r2.ts
        ingest.ts
      index.ts
  extension/
    manifest.json
    content.js
    background.js
    options.html
    popup.html
  .github/workflows/
    scraper.yml
    email-sync.yml
```

## Implementation Order
1. Monorepo scaffold + Prisma schema + Neon connection
2. NextAuth.js with Google and GitHub OAuth
3. AI provider abstraction + resume parsing
4. `POST /api/jobs/ingest`
5. Scraper for Ashby, Greenhouse, and Lever
6. Cloudflare R2 PDF snapshots
7. GitHub Actions workflows
8. Settings page for per-user credentials
9. Gmail OAuth + email sync
10. Dashboard shell + job feed
11. Chrome extension
12. Batch apply queue UI
13. Analytics page

## Integration Boundaries
- Scraper writes jobs into the ingest API, not directly into the database.
- Chrome extension authenticates with a per-user API key.
- Gmail and AI credentials are user-specific and encrypted at rest.
- GitHub Actions is the only background runner in the design.

## Security Notes
- Sensitive user tokens are encrypted with AES-256-GCM.
- `ENCRYPTION_KEY` stays in environment configuration, not the database.
- GitHub Actions calls app endpoints with bearer tokens.

## Environment Inventory
### App / Vercel
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `INGEST_BEARER_TOKEN`
- `EMAIL_SYNC_BEARER_TOKEN`
- `ENCRYPTION_KEY`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

### GitHub Actions
- `VERCEL_URL`
- `INGEST_BEARER_TOKEN`
- `EMAIL_SYNC_BEARER_TOKEN`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## Gaps Right Now
- No `web/`, `scraper/`, `extension/`, or workflow files exist yet.
- No package manager workspace has been initialized.
- No database schema or runtime code exists yet.

## Best Next Step
Implement Step 1 from the spec:
- create the monorepo scaffold
- initialize the package manager workspace
- add Prisma schema
- wire the initial Neon database connection

