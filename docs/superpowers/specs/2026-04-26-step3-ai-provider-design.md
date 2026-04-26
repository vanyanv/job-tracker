# Step 3 Design: AI Provider Abstraction + Resume Parsing

**Date:** 2026-04-26
**Status:** Ready for review

---

## Overview

Step 3 delivers three capabilities that underpin the AI-scoring pipeline:

1. **AI provider abstraction** — a pluggable `AIProvider` interface with four implementations (groq, gemini, claude, rules) and a `getProvider(user)` factory that reads per-user config from the database.
2. **Resume parsing API** — `POST /api/resume`: accepts a PDF upload, extracts text with `unpdf`, calls `provider.parseResume()`, persists to `User.resumeText`, `User.resumeParsed`, `User.skillsProfile`.
3. **Crypto module** — AES-256-GCM `encrypt`/`decrypt` for `aiApiKey` and `gmailToken` fields stored in the database.

No Settings UI is built here. The Settings page (Step 8) exposes the provider picker. Step 3 delivers only the library code, the API route, and the unit tests.

---

## Architecture

### Provider strategy pattern

```
web/lib/ai/
  provider.ts   ← AIProvider interface, Zod schemas, getProvider() factory
  rules.ts      ← keyword scoring, no API calls, always-free fallback
  groq.ts       ← Groq Cloud, llama-3.3-70b-versatile
  gemini.ts     ← Google Gemini 2.5 Flash
  claude.ts     ← Anthropic Haiku 4.5 (claude-haiku-4-5-20251001)
```

`getProvider(user)` in `provider.ts` imports all four implementations at the bottom of the file. Each implementation uses `import type` from `provider.ts` — type-only imports are erased at compile time, so there is no circular value dependency at runtime in ESM.

**Zod v4 as the single source of truth.** `ResumeProfileSchema` and `ScoreResultSchema` are defined in `provider.ts` as Zod schemas. Every provider converts the model's raw output to JSON and calls `schema.parse()`. Zod v4's built-in `z.toJSONSchema()` converts these schemas to JSON Schema objects for providers that accept a formal schema.

### Structured output strategy by provider

| Provider | Mechanism | Notes |
|---|---|---|
| `rules` | Deterministic keyword matching | No LLM, always valid output |
| `groq` | `response_format: { type: "json_object" }` + Zod parse | llama-3.3-70b-versatile does not support `json_schema` strict mode |
| `gemini` | `responseMimeType: "application/json"` + `responseJsonSchema` | Native enforcement via Gemini 2.5 Flash |
| `claude` | Tool use, `tool_choice: { type: "any" }` | Available on all Claude models; structured outputs beta does not yet support Haiku 4.5 |

### Resume API data flow

```
POST /api/resume  (multipart/form-data, field: file)
 │
 ├─ auth() → 401 if no session
 ├─ validate: PDF only, ≤ 5 MB
 ├─ unpdf: getDocumentProxy(Uint8Array) → extractText({ mergePages: true }) → string
 ├─ prisma.user.findUniqueOrThrow({ email: session.user.email })
 ├─ getProvider(user) → AIProvider
 ├─ provider.parseResume(text) → ResumeProfile
 └─ prisma.user.update({
       resumeText:    text,
       resumeParsed:  parsed,
       skillsProfile: parsed.skills.join(","),
    })
 → 200 { ok: true, parsed }
```

---

## Provider Interface

**`web/lib/ai/provider.ts`** — full TypeScript:

```typescript
import { z } from "zod";
import { decrypt } from "@/lib/crypto";

// ── Zod schemas (single source of truth) ──────────────────────────

export const ResumeProfileSchema = z.object({
  skills: z.array(z.string())
    .describe("Technical skills, tools, and frameworks the candidate knows"),
  titles: z.array(z.string())
    .describe("Job titles the candidate has held or is targeting"),
  yearsExperience: z.number().int().min(0)
    .describe("Total years of professional software engineering experience"),
  summary: z.string()
    .describe("Two-sentence professional summary"),
});
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;

export const ScoreResultSchema = z.object({
  score: z.number().int().min(0).max(100)
    .describe("Match score 0–100; 100 = perfect match"),
  reason: z.string()
    .describe("One-sentence explanation of the score"),
});
export type ScoreResult = z.infer<typeof ScoreResultSchema>;

// ── Domain types ───────────────────────────────────────────────────

export interface JobInput {
  title: string;
  company: string;
  location: string;
  description: string | null;
}

// ── Provider interface ─────────────────────────────────────────────

export interface AIProvider {
  /** Score a job against a resume profile. Throws on unrecoverable error. */
  scoreJob(job: JobInput, profile: ResumeProfile): Promise<ScoreResult>;
  /** Parse raw resume text into a structured profile. Throws on unrecoverable error. */
  parseResume(resumeText: string): Promise<ResumeProfile>;
}

// ── User subset ────────────────────────────────────────────────────

export type UserForProvider = {
  aiProvider: string | null;
  aiApiKey: string | null;
};

// ── Factory ────────────────────────────────────────────────────────
// Imports at bottom to minimise circular-reference surface area.
// Each implementation file uses `import type` when importing from here.

import { RulesProvider } from "./rules";
import { GroqProvider } from "./groq";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";

/**
 * Returns the AI provider configured for this user.
 * Falls back to RulesProvider if: no provider configured, decryption fails,
 * or the provider value is unrecognised.
 */
export function getProvider(user: UserForProvider): AIProvider {
  if (!user.aiProvider || !user.aiApiKey) return new RulesProvider();
  let apiKey: string;
  try {
    apiKey = decrypt(user.aiApiKey);
  } catch {
    return new RulesProvider(); // degraded gracefully — key rotated or corrupted
  }
  switch (user.aiProvider) {
    case "groq":   return new GroqProvider(apiKey);
    case "gemini": return new GeminiProvider(apiKey);
    case "claude": return new ClaudeProvider(apiKey);
    default:       return new RulesProvider();
  }
}
```

---

## Resume Parsing Flow

`POST /api/resume` lives at `web/app/api/resume/route.ts`.

Auth dependency: calls `auth()` from `web/auth.ts` (Step 2). The session is expected to carry `session.user.email`. If Step 2 uses `session.user.id` instead, substitute the lookup field — this is the only integration seam.

| Condition | Response |
|---|---|
| No session | 401 `{ error: "Unauthorized" }` |
| Missing/wrong field type | 400 `{ error: "Field 'file' is required..." }` |
| `file.size > 5 MB` | 413 `{ error: "File too large. Maximum size is 5 MB." }` |
| `file.type !== "application/pdf"` | 415 `{ error: "Only PDF files are accepted" }` |
| PDF extraction fails | 500 (error logged server-side, generic message to client) |
| Extracted text < 10 chars | 422 `{ error: "Could not extract meaningful text..." }` |
| `parseResume` throws | 500 |
| Success | 200 `{ ok: true, parsed: ResumeProfile }` |

`pdf.destroy()` is called after text extraction to free PDF.js resources.

`resumeParsed` is stored as `Json` (Prisma type) — Prisma accepts any JSON-serialisable object. `ResumeProfile` is JSON-serialisable by construction.

`skillsProfile` is `parsed.skills.join(",")` — a comma-separated string. This is denormalised for fast `ILIKE` or `LIKE` queries from the Step 5 scraper filter (`user.skillsProfile.split(",")` → keyword list).

---

## Crypto Module

**File:** `web/lib/crypto.ts`

**Algorithm:** AES-256-GCM (authenticated encryption).

**Key:** `process.env.ENCRYPTION_KEY` — must be exactly 64 hex characters (32 bytes). The module throws a descriptive error at call time if absent or wrong length.

**Wire format stored in DB:**
```
{iv_hex}:{authTag_hex}:{ciphertext_hex}
```
- IV: 12 random bytes (96-bit, GCM standard) = 24 hex chars
- Auth tag: 16 bytes (GCM default) = 32 hex chars
- Ciphertext: variable

**Properties:** random IV per call → same plaintext produces different ciphertext; auth tag detects tampering; no extra dependencies (Node built-in `node:crypto`).

**Key generation (run once):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Output: 64 hex chars. Store in Vercel env, local `web/.env`, GitHub Actions secrets.

**Interface:**
```typescript
export function encrypt(plaintext: string): string  // throws if ENCRYPTION_KEY invalid
export function decrypt(ciphertext: string): string // throws if key invalid or data tampered
```

---

## Per-Provider Notes

### `rules` — Keyword matching

**Package:** none. **Model:** none.

`scoreJob`: build a lowercase keyword set from `profile.skills`; test each against `job.title + " " + job.description` using word-boundary regex (`\b`); `score = Math.round(matched/total * 100)` clamped to [0, 100]; `reason` lists the first five matched skills.

`parseResume`: scan text against a hardcoded `TECH_SKILLS` list (~120 SWE skills); extract title-like lines via regex; extract years via `/(\d+)\+?\s+years?\s+(?:of\s+)?experience/i`; take first substantive paragraph as summary (≤ 300 chars).

Edge cases: empty `profile.skills` → score 0, reason "No skills in profile"; no match found → score 0.

---

### `groq` — Llama 3.3 70B

**Package:** `groq-sdk` | **Import:** `import Groq from "groq-sdk"` | **Model:** `"llama-3.3-70b-versatile"` | **Free:** 14,400 req/day

Client: `new Groq({ apiKey })`.

Structured output: `response_format: { type: "json_object" }`. `json_schema` strict mode is not supported on this model. System prompt defines the exact JSON shape; Zod parses and validates the response.

`scoreJob` max_tokens: 128. `parseResume` max_tokens: 512. temperature: 0.1 for both. Truncate description/resume to 3,000/8,000 chars respectively.

Error handling: catch `Groq.APIError`, rethrow as `Error("Groq API error: {message}")`. Catch `ZodError`, rethrow as `Error("Groq response schema mismatch: {issues}")`.

---

### `gemini` — Gemini 2.5 Flash

**Package:** `@google/genai` (new SDK — replaces `@google/generative-ai`) | **Import:** `import { GoogleGenAI } from "@google/genai"` | **Model:** `"gemini-2.5-flash"` | **Free:** 1,500 req/day

Client: `new GoogleGenAI({ apiKey })`.

Structured output: native JSON schema enforcement via `config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(ScoreResultSchema) }`. `z.toJSONSchema()` is a Zod v4 built-in; no extra dependency needed.

Response text: `response.text` (string). Parse with `JSON.parse` then `schema.parse()`.

Error handling: catch generic `Error` (no dedicated error class in `@google/genai` v1), rethrow with context.

---

### `claude` — Haiku 4.5

**Package:** `@anthropic-ai/sdk` | **Import:** `import Anthropic from "@anthropic-ai/sdk"` | **Default model:** `"claude-haiku-4-5-20251001"` | **Cost:** $1/$5 per MTok input/output

Client: `new Anthropic({ apiKey })`. Constructor accepts optional `model?: string` override.

Structured output: tool use with `tool_choice: { type: "any" }`. One tool defined per operation (`submit_score`, `submit_resume_profile`) with `input_schema` set to `z.toJSONSchema(schema)`. The model is forced to call the tool; its `input` field is the structured output. Extract: `response.content.find(b => b.type === "tool_use")?.input`.

Structured outputs beta (`anthropic-beta: structured-outputs-2025-11-13`) is not used — it does not yet support Haiku 4.5 as of 2026-04-26.

`scoreJob` max_tokens: 256. `parseResume` max_tokens: 1,024. Truncate description/resume to 3,000/8,000 chars respectively.

Error handling: catch `Anthropic.APIError`, rethrow with context.

---

## Environment Variables

New variable added by Step 3:

| Variable | Location | Value |
|---|---|---|
| `ENCRYPTION_KEY` | Vercel env + local `web/.env` + GitHub Actions secrets | 64 hex chars from `randomBytes(32).toString('hex')` |

Provider API keys are stored per-user in `User.aiApiKey` (encrypted in DB), NOT in env vars. The factory decrypts at request time.

Test-only env vars (never in production):

| Variable | Used by |
|---|---|
| `GROQ_API_KEY` | `groq.test.ts` (skipped if absent) |
| `GEMINI_API_KEY` | `gemini.test.ts` (skipped if absent) |
| `ANTHROPIC_API_KEY` | `claude.test.ts` (skipped if absent) |

---

## Testing Strategy

**Runner:** `vitest` (ESM-native, Next.js 15 compatible). **Config:** `web/vitest.config.ts` with `vite-tsconfig-paths` to resolve the `@/*` alias.

| Test file | CI | Requires |
|---|---|---|
| `lib/crypto.test.ts` | Yes | `ENCRYPTION_KEY` set in test itself |
| `lib/ai/rules.test.ts` | Yes | None |
| `lib/ai/groq.test.ts` | Skip | `GROQ_API_KEY` |
| `lib/ai/gemini.test.ts` | Skip | `GEMINI_API_KEY` |
| `lib/ai/claude.test.ts` | Skip | `ANTHROPIC_API_KEY` |

API provider tests use `describe.skipIf(!process.env.PROVIDER_API_KEY)` — zero failures when the key is absent, simply skipped.

Crypto tests set `process.env.ENCRYPTION_KEY` in `beforeAll` before the dynamic `import` of `crypto.ts` to avoid module-level env reads before the key is injected.

Common assertions across all provider smoke tests:
- `result.score` is an integer in [0, 100]
- `result.reason` is a non-empty string
- Match job scores strictly higher than no-match job
- All outputs pass `schema.parse()` without throwing

---

## Decisions to Confirm

**1. PDF library: `unpdf` (recommended)**

`pdf-parse` depends on `pdfjs-dist` which has an optional `canvas` native dependency. Vercel's serverless runtime cannot compile native modules, causing build failures or silent runtime crashes. `unpdf` is pure JavaScript, zero native deps, works on Vercel/Lambda/Cloudflare Workers. API: `getDocumentProxy(Uint8Array)` + `extractText(proxy, { mergePages: true })`. Confirmed recommendation: **use `unpdf`**.

**2. DOCX support: deferred to Step 8**

DOCX parsing requires `mammoth` or `docx` packages and adds complexity. PDFs are the universal resume format. Add DOCX in Step 8 when the full upload UI is built. Confirmed recommendation: **PDF only in Step 3**.

**3. Default Claude model: `claude-haiku-4-5-20251001`**

Confirmed API string from Anthropic models overview as of 2026-04-26. Cheapest current Claude model at $1/$5 per MTok. Constructor accepts optional `model` override for Step 8 Settings. Confirmed recommendation: **`claude-haiku-4-5-20251001`**.

**4. Structured output: Zod schema + provider-specific enforcement + Zod parse-and-validate**

Each provider uses the best mechanism available. All providers call `schema.parse()` as the final gate. Zod v4 built-in `z.toJSONSchema()` eliminates the `zod-to-json-schema` package. Confirmed recommendation: **this approach**.

**5. Encryption key generation and storage**

Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Store in: Vercel env (all environments), local `web/.env` (git-ignored), GitHub Actions secrets (for Steps 7+). Do NOT commit to git in any form. Confirmed recommendation: **generate and store immediately**.

**6. AI dependency placement: all in `web/`**

`groq-sdk`, `@google/genai`, `@anthropic-ai/sdk`, `unpdf`, `zod` all go in `web/package.json` dependencies. The scraper communicates with AI via the `POST /api/jobs/ingest` HTTP endpoint (Step 4), not by importing these packages. Confirmed recommendation: **`web/` only**.

---

## What This Step Does NOT Include

- No `POST /api/jobs/ingest` route (Step 4) — that route calls `scoreJob` but is not built here
- No scraper (Step 5) — sends job data to the ingest API, does not import AI providers
- No Settings page UI for provider/key input (Step 8)
- No Gmail integration (Step 9)
- No R2 PDF storage for resumes — resumes are stored as text in Postgres; R2 is for job HTML snapshots in Step 6
- No DOCX support
- No database migration — all needed User fields already exist in the schema from Step 1
- No batch scoring or queue (Step 12)
