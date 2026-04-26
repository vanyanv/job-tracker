import crypto from "node:crypto";
import { encrypt, decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export type GmailToken = {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
};

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  internalDate: number;
};

export type EmailClassification =
  | { kind: "rejection"; matched: string }
  | { kind: "interview"; matched: string }
  | { kind: "unknown" };

function getRedirectUri(): string {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!base) throw new Error("AUTH_URL not configured");
  return `${base.replace(/\/$/, "")}/api/gmail/callback`;
}

function getGoogleClientId(): string {
  const id = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("AUTH_GOOGLE_ID not configured");
  return id;
}

function getGoogleClientSecret(): string {
  const s = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error("AUTH_GOOGLE_SECRET not configured");
  return s;
}

function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not configured");
  return s;
}

export function buildAuthUrl(state: string): string {
  const clientId = getGoogleClientId();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function signState(userId: string): string {
  const secret = getAuthSecret();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}.${nonce}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyState(state: string): string | null {
  let secret: string;
  try {
    secret = getAuthSecret();
  } catch {
    return null;
  }
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [userId, nonce, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}.${nonce}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? userId : null;
}

export async function exchangeCode(code: string): Promise<GmailToken> {
  const body = new URLSearchParams({
    code,
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };
  if (!data.refresh_token) {
    throw new Error(
      "No refresh_token returned. Revoke at myaccount.google.com/permissions and retry.",
    );
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expiry_date: number;
  scope: string;
}> {
  const body = new URLSearchParams({
    client_id: getGoogleClientId(),
    client_secret: getGoogleClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };
  return {
    access_token: data.access_token,
    expiry_date: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? GMAIL_SCOPE,
  };
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gmailToken: true },
  });
  if (!user?.gmailToken) return null;

  let token: GmailToken;
  try {
    token = JSON.parse(decrypt(user.gmailToken)) as GmailToken;
  } catch {
    return null;
  }

  const buffer = 60_000;
  if (token.expiry_date - buffer > Date.now()) {
    return token.access_token;
  }

  const refreshed = await refreshAccessToken(token.refresh_token);
  const updated: GmailToken = { ...token, ...refreshed };
  await prisma.user.update({
    where: { id: userId },
    data: { gmailToken: encrypt(JSON.stringify(updated)) },
  });
  return refreshed.access_token;
}

export async function listRecentMessages(
  accessToken: string,
  query: string,
  maxResults = 100,
): Promise<{ id: string; threadId: string }[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
  const res = await fetch(`${GMAIL_API}/users/me/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail list failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    messages?: { id: string; threadId: string }[];
  };
  return data.messages ?? [];
}

export async function getMessageMeta(
  accessToken: string,
  id: string,
): Promise<GmailMessageMeta | null> {
  const params = new URLSearchParams({
    format: "metadata",
    metadataHeaders: "From",
  });
  params.append("metadataHeaders", "Subject");
  const res = await fetch(`${GMAIL_API}/users/me/messages/${id}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    internalDate?: string;
    payload?: { headers?: { name: string; value: string }[] };
  };
  const headers = data.payload?.headers ?? [];
  const from = headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
  const subject = headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
  return {
    id: data.id,
    threadId: data.threadId,
    from,
    subject,
    snippet: data.snippet ?? "",
    internalDate: Number(data.internalDate ?? "0"),
  };
}

const REJECTION_PATTERNS: { rx: RegExp; label: string }[] = [
  { rx: /\bnot moving forward\b/i, label: "not moving forward" },
  { rx: /\bdecided to (move forward|proceed) with other\b/i, label: "moving forward with others" },
  { rx: /\bunfortunately[, ]/i, label: "unfortunately" },
  { rx: /\bwe (regret|are sorry) to inform\b/i, label: "regret to inform" },
  { rx: /\bnot (a |the )?(right|best) (fit|match)\b/i, label: "not the right fit" },
  { rx: /\bwill not be (moving|proceeding|considering)\b/i, label: "will not be moving" },
  { rx: /\bother candidates? (whose|that)\b/i, label: "other candidates" },
  { rx: /\bdeclined\b.*\bapplication\b/i, label: "declined application" },
];

const INTERVIEW_PATTERNS: { rx: RegExp; label: string }[] = [
  { rx: /\b(schedule|set up|book)\b.*\binterview\b/i, label: "schedule interview" },
  { rx: /\binvite (you )?to (an )?interview\b/i, label: "invite to interview" },
  { rx: /\bphone screen\b/i, label: "phone screen" },
  { rx: /\btechnical (interview|screen)\b/i, label: "technical interview" },
  { rx: /\bmove (to|forward to) (the )?(next|final) (round|stage)\b/i, label: "next round" },
  { rx: /\b(meet|chat) with (our|the) team\b/i, label: "meet with team" },
  { rx: /\bavailability for (a |an )?(call|chat|interview)\b/i, label: "availability" },
  { rx: /\bnext steps?\b/i, label: "next steps" },
];

export function classifyEmail(subject: string, snippet: string): EmailClassification {
  const haystack = `${subject}\n${snippet}`;
  for (const { rx, label } of INTERVIEW_PATTERNS) {
    if (rx.test(haystack)) return { kind: "interview", matched: label };
  }
  for (const { rx, label } of REJECTION_PATTERNS) {
    if (rx.test(haystack)) return { kind: "rejection", matched: label };
  }
  return { kind: "unknown" };
}

export function extractSenderDomain(from: string): string | null {
  const m = from.match(/<([^>]+)>/) ?? from.match(/(\S+@\S+)/);
  if (!m) return null;
  const email = m[1] ?? m[0];
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase().replace(/[>\s]/g, "");
}

export function extractSenderName(from: string): string {
  const m = from.match(/^"?([^"<]+?)"?\s*</);
  return (m?.[1] ?? from).trim();
}
