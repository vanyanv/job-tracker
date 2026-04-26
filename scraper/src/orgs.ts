export const ASHBY_ORGS: string[] = [
  "linear",
  "ramp",
  "retool",
  "vanta",
  "harvey",
  "notion",
  "brex",
  "rippling",
  "figma",
  "vercel",
  "anthropic",
  "scale-ai",
  "openai",
  "confluent",
  "checkout.com",
  "traba",
  "zapier",
  "pylon-labs",
];

export const GREENHOUSE_ORGS: string[] = [
  "stripe",
  "airbnb",
  "pinterest",
  "reddit",
  "doordash",
  "coinbase",
  "robinhood",
  "lyft",
  "twilio",
  "zendesk",
  "squarespace",
  "hubspot",
  "flexport",
  "duolingo",
  "plaid",
  "mongodb",
  "datadog",
];

export const LEVER_ORGS: string[] = [
  "palantir",
  "netflix",
  "atlassian",
  "shopify",
  "coursera",
  "asana",
  "okta",
  "cloudflare",
  "elastic",
  "replit",
  "benchling",
  "expensify",
  "carta",
  "captivateiq",
  "voleon",
];

const COMPANY_NAMES: Record<string, string> = {
  "scale-ai": "Scale AI",
  "openai": "OpenAI",
  "pylon-labs": "Pylon",
  "checkout.com": "Checkout.com",
  "captivateiq": "CaptivateIQ",
  "mongodb": "MongoDB",
  "hubspot": "HubSpot",
  "doordash": "DoorDash",
  "github": "GitHub",
  "okta": "Okta",
};

export function orgToCompany(slug: string): string {
  if (COMPANY_NAMES[slug]) return COMPANY_NAMES[slug];
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
