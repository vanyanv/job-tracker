# Step 1 Design: Monorepo Scaffold + Prisma Schema + Neon Connection

**Date:** 2026-04-26
**Status:** Approved

---

## Overview

Initialize the job-tracker monorepo with three packages (`web`, `scraper`, `extension`), set up the full Prisma schema with all six models, and wire the Neon Postgres connection via a syntactically valid placeholder `DATABASE_URL`. No database migration runs until a real connection string is provided.

---

## Package Manager

pnpm workspaces. pnpm version pinned in root `package.json` via `packageManager` field. Root `pnpm-workspace.yaml`:

```yaml
packages:
  - "web"
  - "scraper"
  - "extension"
```

Each workspace directory must have a `package.json` with a `name` field matching its directory name (`web`, `scraper`, `extension`).

---

## Monorepo Scaffold

### Root (`job-tracker/`)

`package.json`:
```json
{
  "name": "job-tracker",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "dev": "pnpm --filter web dev"
  }
}
```

`.gitignore` (single root file — no per-package `.gitignore` files needed):
```
node_modules/
.env
.env.local
.env*.local
dist/
.next/
*.tsbuildinfo
prisma/migrations/
```

### `web/` — Next.js 15 App Router

**Create manually** (do not use `create-next-app` — it generates extra files like `README.md`, `eslint.config.mjs` that are not part of this spec).

`package.json`:
```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0"
  }
}
```

**File creation order (important — shadcn init must run after base files exist):**

1. Create `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
2. Create `prisma/schema.prisma` and `lib/prisma.ts`
3. Create `app/layout.tsx` and `app/page.tsx` (minimal stubs)
4. Create `.env.local` with placeholder
5. Run `pnpm install` from repo root
6. Run shadcn init (step 6 generates `lib/utils.ts`, `components.json`, `app/globals.css`, `tailwind.config.ts`) — do **not** create these files before this step

**shadcn/ui init:**

shadcn 2.x CLI supports Tailwind v4 natively. Run from `web/`:
```bash
pnpm dlx shadcn@2 init --defaults
```
The `--defaults` flag skips interactive prompts and uses: style=New York, baseColor=neutral, CSS variables=yes.

This generates:
- `components.json`
- `app/globals.css` (Tailwind directives + CSS variable definitions)
- `lib/utils.ts` (exports `cn()` — **do not create this manually**)
- `tailwind.config.ts`

`components/ui/` starts empty and is populated via `pnpm dlx shadcn@2 add <component>` in later steps.

**`tsconfig.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**`next.config.ts`:**
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

**`postcss.config.mjs`:**
```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

**`app/layout.tsx`:**
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Job Tracker" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**`app/page.tsx`:**
```tsx
export default function Home() {
  return <main><h1>Job Tracker</h1></main>;
}
```

### `scraper/` — Node.js + Playwright

`package.json`:
```json
{
  "name": "scraper",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "start": "ts-node src/index.ts"
  },
  "dependencies": {
    "playwright": "^1.40.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.0.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

`src/index.ts`:
```ts
console.log("scraper ready");
```

### `extension/` — Chrome Extension MV3

`package.json`:
```json
{
  "name": "extension",
  "version": "0.0.1",
  "private": true
}
```

`manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Job Tracker",
  "version": "0.0.1",
  "description": "Auto-marks job applications as applied",
  "permissions": [],
  "host_permissions": []
}
```

---

## Prisma Schema

Location: `web/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Job {
  id          String    @id @default(cuid())
  title       String
  company     String
  url         String    @unique
  source      String
  location    String
  description String?
  postedAt    DateTime
  foundAt     DateTime  @default(now())
  snapshotUrl String?
  userJobs    UserJob[]
}

model UserJob {
  id          String    @id @default(cuid())
  userId      String
  jobId       String
  score       Int?
  scoreReason String?
  status      String    @default("new")
  appliedAt   DateTime?
  emailNote   String?
  user        User      @relation(fields: [userId], references: [id])
  job         Job       @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  gmailToken    String?
  aiProvider    String?
  aiApiKey      String?
  resumeUrl     String?
  resumeText    String?
  resumeParsed  Json?
  skillsProfile String?
  apiKey        String    @unique @default(cuid())
  userJobs      UserJob[]
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

---

## `lib/prisma.ts` Singleton

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Prevents connection pool exhaustion from Next.js hot-reload creating multiple PrismaClient instances in development.

---

## `.env.local` Placeholder

```env
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
```

Syntactically valid PostgreSQL URL so `prisma validate` and `prisma generate` succeed. Replace with the real Neon pooled connection string (with `?sslmode=require`) before running `prisma migrate dev`.

---

## Verification (no real DB required)

All three steps must pass before Step 1 is considered complete.

**1. Install:**
```bash
# from repo root
pnpm install
```
Expected: exits 0, all three workspace packages resolved, no peer dependency errors.

**2. Schema validation:**
```bash
cd web && pnpm prisma validate
```
Expected output: `The schema at prisma/schema.prisma is valid 🚀`
Prerequisite: `.env.local` must exist with the placeholder `DATABASE_URL` above.

**3. Client generation:**
```bash
cd web && pnpm prisma generate
```
Expected: exits 0. Confirm client was generated:
```bash
# from web/ directory — works with both CJS and ESM Next.js configs
cd web && node --input-type=commonjs -e "require('@prisma/client'); console.log('prisma client ok')"
```
Generated client location: `web/node_modules/.prisma/client/` (default output; no custom `output` path set in schema).

---

**When `DATABASE_URL` is set to a real Neon connection string:**

**4. Migration:**
```bash
cd web && pnpm prisma migrate dev --name init
```
Expected: 6 tables created, migration file saved to `web/prisma/migrations/`.

**5. Seed verification** (run once manually to confirm round-trip):
```ts
// web/prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.create({
    data: { email: "test@example.com", name: "Test User" },
  });
  const job = await prisma.job.create({
    data: {
      title: "Software Engineer",
      company: "Acme",
      url: "https://example.com/job/1",
      source: "greenhouse",
      location: "Remote",
      postedAt: new Date(),
    },
  });
  await prisma.userJob.create({
    data: { userId: user.id, jobId: job.id, status: "new" },
  });
  const result = await prisma.userJob.findFirst({
    include: { user: true, job: true },
  });
  console.log(JSON.stringify(result, null, 2));
}
main().then(() => prisma.$disconnect()).catch(console.error);
```
Run: `cd web && npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed.ts`
Expected: prints the UserJob record with nested `user` and `job` objects.

---

## What This Step Does NOT Include

- No NextAuth.js wiring (Step 2)
- No API routes (Steps 4+)
- No actual database migration (requires real `DATABASE_URL`)
- No scraper logic (Step 5)
- No UI beyond `app/layout.tsx` and `app/page.tsx`
- No shadcn components added (added on demand in later steps via `pnpm dlx shadcn@2 add`)
